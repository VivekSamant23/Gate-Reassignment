#!/usr/bin/env python3
"""Add sample flights to the database for testing"""

from extensions import db
from models import Flight
from datetime import datetime, date

def add_sample_flights():
    """Add sample flights for testing"""
    
    sample_flights = [
        {
            'flight_number': 'AA123',
            'scheduled_date': date.today(),
            'scheduled_time': '08:00',
            'aircraft_registration': 'N12345A',
            'aircraft_type': 'narrow_body',
            'new_position': 'A10',
            'old_position': 'A10',
            'assigned_gate': 'A1',
            'planned_gate': 'A1',
            'flight_type': 'arrival',
            'status': 'scheduled'
        },
        {
            'flight_number': 'UA456',
            'scheduled_date': date.today(),
            'scheduled_time': '09:30',
            'aircraft_registration': 'N67890B',
            'aircraft_type': 'wide_body',
            'new_position': 'B2',
            'old_position': 'B2',
            'assigned_gate': 'A3',
            'planned_gate': 'A3',
            'flight_type': 'departure',
            'status': 'scheduled'
        },
        {
            'flight_number': 'DL789',
            'scheduled_date': date.today(),
            'scheduled_time': '11:15',
            'aircraft_registration': 'N11111C',
            'aircraft_type': 'narrow_body',
            'new_position': 'A1',
            'old_position': 'A1',
            'assigned_gate': 'B1',
            'planned_gate': 'B1',
            'flight_type': 'arrival',
            'status': 'delayed'
        },
        {
            'flight_number': 'SW321',
            'scheduled_date': date.today(),
            'scheduled_time': '13:00',
            'aircraft_registration': 'N22222D',
            'aircraft_type': 'narrow_body',
            'new_position': 'B1',
            'old_position': 'B1',
            'assigned_gate': 'A2',
            'planned_gate': 'A2',
            'flight_type': 'departure',
            'status': 'scheduled'
        },
        {
            'flight_number': 'BA654',
            'scheduled_date': date.today(),
            'scheduled_time': '14:45',
            'aircraft_registration': 'N33333E',
            'aircraft_type': 'wide_body',
            'new_position': 'A3',
            'old_position': 'A3',
            'assigned_gate': 'B2',
            'planned_gate': 'B2',
            'flight_type': 'arrival',
            'status': 'scheduled'
        }
    ]
    
    # Clear existing flights
    Flight.query.delete()
    
    # Add new flights
    for flight_data in sample_flights:
        flight = Flight(**flight_data)
        db.session.add(flight)
    
    db.session.commit()
    print(f"Added {len(sample_flights)} sample flights")

if __name__ == '__main__':
    from app import app
    with app.app_context():
        add_sample_flights()
