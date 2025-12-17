import pandas as pd
import requests
from datetime import datetime, timedelta
from io import StringIO
import json
from models import Flight, Gate, AirportConfig
from extensions import db
from sqlalchemy import and_, or_

class DataIntegration:
    def __init__(self):
        self.aodb_config = None
        self.gms_config = None
    
    def _get_config(self, config_key):
        config = AirportConfig.query.filter_by(config_key=config_key).first()
        if config:
            return json.loads(config.config_value) if config.config_type == 'json' else config.config_value
        return {}
    
    def get_flights(self, date=None):
        """Get flights from database or external APIs"""
        if date:
            target_date = datetime.strptime(date, '%Y-%m-%d').date()
        else:
            target_date = datetime.now().date()
        
        # Try to get from database first
        flights = Flight.query.filter(
            Flight.scheduled_date == target_date
        ).all()
        
        if not flights:
            # If no flights in database, try to fetch from external APIs
            flights = self._fetch_flights_from_apis(target_date)
        
        return [flight.to_dict() for flight in flights]
    
    def _fetch_flights_from_apis(self, date):
        flights = []
        
        # Fetch from AODB
        try:
            aodb_flights = self._fetch_from_aodb(date)
            flights.extend(aodb_flights)
        except Exception as e:
            print(f"Error fetching from AODB: {e}")
        
        # Fetch from GMS
        try:
            gms_flights = self._fetch_from_gms(date)
            flights.extend(gms_flights)
        except Exception as e:
            print(f"Error fetching from GMS: {e}")
        
        # Save to database
        self._save_flights(flights)
        
        return flights
    
    def _fetch_from_aodb(self, date):
        """Fetch flight data from AODB API"""
        if self.aodb_config is None:
            self.aodb_config = self._get_config('aodb_api')

        if not self.aodb_config:
            return []
        
        # Mock implementation - replace with actual API call
        # url = f"{self.aodb_config.get('base_url')}/flights"
        # headers = {'Authorization': f"Bearer {self.aodb_config.get('api_key')}"}
        # params = {'date': date.isoformat()}
        # response = requests.get(url, headers=headers, params=params)
        # return response.json()
        
        # Return mock data for now
        return self._generate_mock_flights(date, source='aodb')
    
    def _fetch_from_gms(self, date):
        """Fetch gate assignment data from GMS API"""
        if self.gms_config is None:
            self.gms_config = self._get_config('gms_api')

        if not self.gms_config:
            return []
        
        # Mock implementation - replace with actual API call
        # url = f"{self.gms_config.get('base_url')}/gate-assignments"
        # headers = {'Authorization': f"Bearer {self.gms_config.get('api_key')}"}
        # params = {'date': date.isoformat()}
        # response = requests.get(url, headers=headers, params=params)
        # return response.json()
        
        return []
    
    def _generate_mock_flights(self, date, source='aodb'):
        """Generate mock flight data for testing"""
        mock_flights = []
        
        flight_data = [
            {'flight_number': 'AA123', 'aircraft_type': 'narrow_body', 'flight_type': 'arrival'},
            {'flight_number': 'UA456', 'aircraft_type': 'wide_body', 'flight_type': 'departure'},
            {'flight_number': 'DL789', 'aircraft_type': 'narrow_body', 'flight_type': 'arrival'},
            {'flight_number': 'SW321', 'aircraft_type': 'narrow_body', 'flight_type': 'departure'},
            {'flight_number': 'BA654', 'aircraft_type': 'wide_body', 'flight_type': 'arrival'},
        ]
        
        for i, data in enumerate(flight_data):
            flight = Flight(
                flight_number=data['flight_number'],
                scheduled_date=date,
                scheduled_time=(datetime.now() + timedelta(hours=i)).time(),
                aircraft_registration=f"N{12345 + i}A",
                aircraft_type=data['aircraft_type'],
                assigned_gate=f"A{10 + i}",
                planned_gate=f"A{10 + i}",
                flight_type=data['flight_type'],
                status='scheduled'
            )
            mock_flights.append(flight)
        
        return mock_flights
    
    def _save_flights(self, flights):
        """Save flights to database"""
        for flight in flights:
            # Check if flight already exists
            existing = Flight.query.filter(
                Flight.flight_number == flight.flight_number,
                Flight.scheduled_date == flight.scheduled_date
            ).first()
            
            if not existing:
                db.session.add(flight)
        
        db.session.commit()
    
    def update_gate_assignments(self, assignments):
        """Update gate assignments for flights"""
        updated_count = 0
        
        for assignment in assignments:
            flight = Flight.query.get(assignment['flight_id'])
            if flight:
                flight.assigned_gate = assignment['new_gate']
                flight.updated_at = datetime.utcnow()
                updated_count += 1
        
        db.session.commit()
        return updated_count
    
    def get_airport_config(self):
        """Get airport configuration"""
        configs = AirportConfig.query.all()
        return {config.config_key: config.to_dict() for config in configs}
    
    def update_airport_config(self, config_data):
        """Update airport configuration"""
        updated_count = 0
        
        for key, value in config_data.items():
            config = AirportConfig.query.filter_by(config_key=key).first()
            if config:
                config.config_value = value.get('value') if isinstance(value, dict) else value
                config.updated_at = datetime.utcnow()
                updated_count += 1
            else:
                # Create new config
                new_config = AirportConfig(
                    config_key=key,
                    config_value=value.get('value') if isinstance(value, dict) else value,
                    config_type=value.get('type', 'string') if isinstance(value, dict) else 'string',
                    description=value.get('description', '') if isinstance(value, dict) else ''
                )
                db.session.add(new_config)
                updated_count += 1
        
        db.session.commit()
        return updated_count
    
    def process_uploaded_file(self, file):
        """Process uploaded flight data file"""
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file)
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file)
        else:
            raise ValueError("Unsupported file format. Please upload CSV or Excel file.")
        
        # Validate required columns
        required_columns = [
            'flight_number', 'scheduled_date', 'scheduled_time',
            'aircraft_registration', 'aircraft_type', 'flight_type'
        ]
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
        
        # Process and save flights
        flights = []
        for _, row in df.iterrows():
            try:
                flight = Flight(
                    flight_number=row['flight_number'],
                    scheduled_date=pd.to_datetime(row['scheduled_date']).date(),
                    scheduled_time=pd.to_datetime(row['scheduled_time']).time(),
                    aircraft_registration=row.get('aircraft_registration', ''),
                    aircraft_type=row['aircraft_type'],
                    new_position=row.get('new_position', ''),
                    old_position=row.get('old_position', ''),
                    assigned_gate=row.get('assigned_gate', ''),
                    planned_gate=row.get('planned_gate', ''),
                    flight_type=row['flight_type'],
                    status=row.get('status', 'scheduled')
                )
                flights.append(flight)
            except Exception as e:
                print(f"Error processing row {row}: {e}")
        
        # Save to database
        self._save_flights(flights)
        
        return {
            'processed_rows': len(df),
            'saved_flights': len(flights),
            'columns': list(df.columns)
        }
    
    def initialize_default_config(self):
        """Initialize default airport configuration"""
        default_configs = [
            {
                'key': 'aodb_api',
                'value': '{"base_url": "https://api.aodb.example.com", "api_key": ""}',
                'type': 'json',
                'description': 'AODB API configuration'
            },
            {
                'key': 'gms_api',
                'value': '{"base_url": "https://api.gms.example.com", "api_key": ""}',
                'type': 'json',
                'description': 'GMS API configuration'
            },
            {
                'key': 'optimization_weights',
                'value': '{"compatibility": 0.5, "turnaround": 0.3, "distance": 0.2}',
                'type': 'json',
                'description': 'Optimization algorithm weights'
            }
        ]
        
        for config in default_configs:
            existing = AirportConfig.query.filter_by(config_key=config['key']).first()
            if not existing:
                new_config = AirportConfig(
                    config_key=config['key'],
                    config_value=config['value'],
                    config_type=config['type'],
                    description=config['description']
                )
                db.session.add(new_config)
        
        db.session.commit()
    
    def initialize_default_gates(self):
        """Initialize default gate configuration"""
        default_gates = [
            {'gate_number': 'A1', 'gate_type': 'gate', 'max_aircraft': 1, 'aircraft_types': 'narrow_body', 'terminal': 'A', 'coordinates_x': 100, 'coordinates_y': 50},
            {'gate_number': 'A2', 'gate_type': 'gate', 'max_aircraft': 1, 'aircraft_types': 'narrow_body', 'terminal': 'A', 'coordinates_x': 200, 'coordinates_y': 50},
            {'gate_number': 'A3', 'gate_type': 'gate', 'max_aircraft': 1, 'aircraft_types': 'wide_body,narrow_body', 'terminal': 'A', 'coordinates_x': 300, 'coordinates_y': 50},
            {'gate_number': 'B1', 'gate_type': 'gate', 'max_aircraft': 1, 'aircraft_types': 'narrow_body', 'terminal': 'B', 'coordinates_x': 100, 'coordinates_y': 150},
            {'gate_number': 'B2', 'gate_type': 'gate', 'max_aircraft': 1, 'aircraft_types': 'wide_body', 'terminal': 'B', 'coordinates_x': 200, 'coordinates_y': 150},
            {'gate_number': 'H1', 'gate_type': 'hangar', 'max_aircraft': 3, 'aircraft_types': 'wide_body,narrow_body', 'terminal': 'H', 'coordinates_x': 400, 'coordinates_y': 100},
            {'gate_number': 'R1', 'gate_type': 'ramp', 'max_aircraft': 2, 'aircraft_types': 'narrow_body', 'terminal': 'R', 'coordinates_x': 500, 'coordinates_y': 100},
        ]
        
        for gate_data in default_gates:
            existing = Gate.query.filter_by(gate_number=gate_data['gate_number']).first()
            if not existing:
                gate = Gate(
                    gate_number=gate_data['gate_number'],
                    gate_type=gate_data['gate_type'],
                    max_aircraft=gate_data['max_aircraft'],
                    aircraft_types=gate_data['aircraft_types'],
                    terminal=gate_data['terminal'],
                    coordinates_x=gate_data['coordinates_x'],
                    coordinates_y=gate_data['coordinates_y']
                )
                db.session.add(gate)
        
        db.session.commit()
