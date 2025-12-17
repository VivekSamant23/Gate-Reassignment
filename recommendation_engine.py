import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from models import Flight, Gate, Recommendation
from extensions import db
from sqlalchemy import and_, or_

class RecommendationEngine:
    def __init__(self):
        self.optimization_weights = {
            'compatibility': 0.5,
            'turnaround': 0.3,
            'distance': 0.2
        }
    
    def generate_recommendations(self, flight_ids):
        recommendations = []
        
        for flight_id in flight_ids:
            flight = Flight.query.get(flight_id)
            if not flight:
                continue
            
            # Get available gates
            available_gates = self._get_available_gates(flight)
            
            # Calculate scores for each gate
            for gate in available_gates:
                scores = self._calculate_gate_scores(flight, gate)
                total_score = self._calculate_total_score(scores)
                
                recommendation = {
                    'flight_id': flight_id,
                    'gate_id': gate.id,
                    'gate_number': gate.gate_number,
                    'scores': scores,
                    'total_score': total_score
                }
                recommendations.append(recommendation)
        
        # Sort by total score (descending)
        recommendations.sort(key=lambda x: x['total_score'], reverse=True)
        
        # Save to database
        self._save_recommendations(recommendations)
        
        return recommendations
    
    def _get_available_gates(self, flight):
        current_time = datetime.utcnow()
        
        # Get gates that are compatible with aircraft type
        compatible_gates = Gate.query.filter(
            Gate.is_active == True,
            Gate.maintenance_status == 'available',
            Gate.aircraft_types.like(f'%{flight.aircraft_type}%')
        ).all()
        
        available_gates = []
        
        for gate in compatible_gates:
            # Check if gate is available during flight's time window
            if self._is_gate_available(gate, flight, current_time):
                available_gates.append(gate)
        
        return available_gates
    
    def _is_gate_available(self, gate, flight, current_time):
        # Get conflicting flights at this gate
        conflicting_flights = Flight.query.filter(
            Flight.assigned_gate == gate.gate_number,
            Flight.id != flight.id,
            Flight.status.in_(['scheduled', 'delayed']),
            or_(
                and_(
                    Flight.scheduled_date == flight.scheduled_date,
                    # Check time overlap (simplified - would need more sophisticated logic)
                    Flight.flight_type == flight.flight_type
                )
            )
        ).all()
        
        # For hangars/ramps that can accommodate multiple aircraft
        if gate.gate_type in ['hangar', 'ramp'] and gate.max_aircraft > 1:
            current_aircraft_count = len(conflicting_flights)
            return current_aircraft_count < gate.max_aircraft
        
        # For regular gates - only one aircraft allowed
        return len(conflicting_flights) == 0
    
    def _calculate_gate_scores(self, flight, gate):
        scores = {}
        
        # Compatibility score (0-100)
        scores['compatibility'] = self._calculate_compatibility_score(flight, gate)
        
        # Turnaround time score (0-100)
        scores['turnaround'] = self._calculate_turnaround_score(flight, gate)
        
        # Passenger walking distance score (0-100)
        scores['distance'] = self._calculate_distance_score(flight, gate)
        
        return scores
    
    def _calculate_compatibility_score(self, flight, gate):
        # Base compatibility from aircraft type
        if flight.aircraft_type in gate.aircraft_types.split(','):
            base_score = 100
        else:
            return 0  # Incompatible
        
        # Adjust for gate type
        if gate.gate_type == 'gate':
            return base_score
        elif gate.gate_type == 'ramp':
            return base_score * 0.9  # Slightly less preferred than gates
        elif gate.gate_type == 'hangar':
            return base_score * 0.8  # Least preferred for passenger flights
        
        return base_score * 0.7  # Unknown gate type
    
    def _calculate_turnaround_score(self, flight, gate):
        # Simplified turnaround time calculation
        # In reality, this would consider ground handling equipment availability,
        # taxiway distance, etc.
        
        if gate.gate_type == 'gate':
            # Gates typically have fastest turnaround
            base_turnaround = 30  # minutes
        elif gate.gate_type == 'ramp':
            base_turnaround = 35
        elif gate.gate_type == 'hangar':
            base_turnaround = 45
        else:
            base_turnaround = 40
        
        # Score based on how fast the turnaround is (lower is better)
        # Normalize to 0-100 scale
        min_turnaround = 25
        max_turnaround = 60
        
        if base_turnaround <= min_turnaround:
            return 100
        elif base_turnaround >= max_turnaround:
            return 0
        else:
            # Linear interpolation
            score = 100 * (max_turnaround - base_turnaround) / (max_turnaround - min_turnaround)
            return max(0, min(100, score))
    
    def _calculate_distance_score(self, flight, gate):
        # Simplified passenger walking distance calculation
        # In reality, this would consider terminal layout, connecting flights, etc.
        
        if not gate.coordinates_x or not gate.coordinates_y:
            # Default score if coordinates not available
            return 50
        
        # Assume terminal center at (0,0) for simplicity
        terminal_center_x, terminal_center_y = 0, 0
        
        # Calculate distance from terminal center
        distance = np.sqrt(
            (gate.coordinates_x - terminal_center_x) ** 2 + 
            (gate.coordinates_y - terminal_center_y) ** 2
        )
        
        # Score based on distance (closer is better)
        # Normalize to 0-100 scale
        max_distance = 1000  # meters
        
        if distance <= 0:
            return 100
        elif distance >= max_distance:
            return 0
        else:
            score = 100 * (1 - distance / max_distance)
            return max(0, min(100, score))
    
    def _calculate_total_score(self, scores):
        total = (
            scores['compatibility'] * self.optimization_weights['compatibility'] +
            scores['turnaround'] * self.optimization_weights['turnaround'] +
            scores['distance'] * self.optimization_weights['distance']
        )
        return round(total, 2)
    
    def _save_recommendations(self, recommendations):
        # Clear existing recommendations for these flights
        flight_ids = [rec['flight_id'] for rec in recommendations]
        Recommendation.query.filter(Recommendation.flight_id.in_(flight_ids)).delete()
        
        # Save new recommendations
        for rec in recommendations:
            recommendation = Recommendation(
                flight_id=rec['flight_id'],
                gate_id=rec['gate_id'],
                compatibility_score=rec['scores']['compatibility'],
                turnaround_score=rec['scores']['turnaround'],
                distance_score=rec['scores']['distance'],
                total_score=rec['total_score']
            )
            db.session.add(recommendation)
        
        db.session.commit()
    
    def update_optimization_weights(self, weights):
        """Update optimization weights"""
        if sum(weights.values()) == 1.0:
            self.optimization_weights = weights
            return True
        return False
