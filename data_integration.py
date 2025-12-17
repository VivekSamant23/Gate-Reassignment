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
            flights = Flight.query.filter(
                Flight.scheduled_date == target_date
            ).order_by(Flight.scheduled_date.asc(), Flight.scheduled_time.asc()).all()
        else:
            flights = Flight.query.order_by(Flight.scheduled_date.asc(), Flight.scheduled_time.asc()).all()
        
        if date and not flights:
            # If no flights in database for a specific date, try to fetch from external APIs
            flights = self._fetch_flights_from_apis(target_date)
        
        return [flight.to_dict() for flight in flights]
    
    def create_flight(self, flight_data):
        """Create a new flight"""
        try:
            flight_number = (flight_data.get('flight_number') or '').strip()
            scheduled_date_raw = flight_data.get('scheduled_date')
            scheduled_time_raw = flight_data.get('scheduled_time')

            if not flight_number:
                raise ValueError('flight_number is required')
            if not scheduled_date_raw:
                raise ValueError('scheduled_date is required')
            if not scheduled_time_raw:
                raise ValueError('scheduled_time is required')

            if isinstance(scheduled_date_raw, str):
                scheduled_date = datetime.fromisoformat(scheduled_date_raw).date()
            else:
                scheduled_date = scheduled_date_raw

            if isinstance(scheduled_time_raw, str):
                # Accept HH:MM or HH:MM:SS
                time_str = scheduled_time_raw.strip()
                fmt = '%H:%M:%S' if len(time_str.split(':')) == 3 else '%H:%M'
                scheduled_time = datetime.strptime(time_str, fmt).time()
            else:
                scheduled_time = scheduled_time_raw

            flight = Flight(
                flight_number=flight_number,
                scheduled_date=scheduled_date,
                scheduled_time=scheduled_time,
                aircraft_registration=(flight_data.get('aircraft_registration') or '').strip(),
                aircraft_type=flight_data.get('aircraft_type'),
                new_position=flight_data.get('new_position'),
                old_position=flight_data.get('old_position'),
                assigned_gate=flight_data.get('assigned_gate'),
                planned_gate=flight_data.get('planned_gate'),
                flight_type=flight_data.get('flight_type'),
                status=flight_data.get('status') or 'scheduled'
            )
            db.session.add(flight)
            db.session.commit()
            return flight.to_dict()
        except Exception as e:
            db.session.rollback()
            raise e
    
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
        added = 0
        try:
            for flight in flights:
                # Check if flight already exists
                existing = Flight.query.filter(
                    Flight.flight_number == flight.flight_number,
                    Flight.scheduled_date == flight.scheduled_date
                ).first()

                if not existing:
                    db.session.add(flight)
                    added += 1

            db.session.commit()
            return added
        except Exception:
            db.session.rollback()
            raise
    
    def update_gate_assignments(self, assignments):
        """Update gate assignments for flights"""
        updated_count = 0
        
        for assignment in assignments:
            flight = Flight.query.get(assignment['flight_id'])
            if flight:
                # Frontend may send new_gate (gate number), gate_number, or gate_id
                new_gate = assignment.get('new_gate') or assignment.get('gate_number')
                gate_id = assignment.get('gate_id')
                if not new_gate and gate_id:
                    gate = Gate.query.get(gate_id)
                    new_gate = gate.gate_number if gate else None

                if not new_gate:
                    continue

                flight.assigned_gate = new_gate
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
        """Process uploaded flight data file (legacy, for in-memory file objects)"""
        import os, tempfile
        # Save to temp file and delegate to path-based method
        suffix = ''
        if hasattr(file, 'filename') and file.filename:
            suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        try:
            return self.process_uploaded_file_path(tmp_path)
        finally:
            os.unlink(tmp_path)

    def process_uploaded_file_path(self, file_path):
        """Process uploaded flight data file from a path (logs each step)"""
        import logging
        logger = logging.getLogger(__name__)
        logger.info("process_uploaded_file_path: start %s", file_path)
        try:
            import pandas as pd
            logger.info("Reading file with pandas...")
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            elif file_path.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file_path)
            else:
                raise ValueError("Unsupported file format. Please upload CSV or Excel file.")
            logger.info("File read, shape: %s", df.shape)
            
            # Validate required columns
            required_columns = [
                'flight_number', 'scheduled_date', 'scheduled_time',
                'aircraft_registration', 'aircraft_type', 'flight_type'
            ]
            logger.info("Validating columns...")
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
            logger.info("Columns validated")
            
            # Process and save flights in batches to avoid hanging
            flights = []
            batch_size = 100
            saved_total = 0
            logger.info("Processing rows...")
            for idx, (_, row) in df.iterrows():
                try:
                    scheduled_time_val = row['scheduled_time']
                    scheduled_time = pd.to_datetime(scheduled_time_val).time()
                    flight = Flight(
                        flight_number=row['flight_number'],
                        scheduled_date=pd.to_datetime(row['scheduled_date']).date(),
                        scheduled_time=scheduled_time,
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
                    # Commit every batch_size rows to avoid long transaction
                    if (idx + 1) % batch_size == 0:
                        logger.info("Committing batch at row %d", idx+1)
                        saved_total += self._save_flights(flights)
                        flights = []
                except Exception as e:
                    logger.error("Error processing row %d: %s", idx, e)
            
            # Save any remaining flights
            if flights:
                logger.info("Committing final batch (%d flights)", len(flights))
                saved_total += self._save_flights(flights)
            
            logger.info("Processing complete")
            return {
                'processed_rows': len(df),
                'saved_flights': saved_total,
                'columns': list(df.columns)
            }
        except Exception as e:
            logger.error("Exception in process_uploaded_file_path: %s", e)
            raise
    
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
