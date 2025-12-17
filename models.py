from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from extensions import db

class Flight(db.Model):
    __tablename__ = 'flights'
    
    id = db.Column(db.Integer, primary_key=True)
    flight_number = db.Column(db.String(20), nullable=False)
    scheduled_date = db.Column(db.Date, nullable=False)
    scheduled_time = db.Column(db.Time, nullable=False)
    aircraft_registration = db.Column(db.String(20))
    aircraft_type = db.Column(db.String(50))  # 'wide_body' or 'narrow_body'
    
    # Position information
    new_position = db.Column(db.String(50))
    old_position = db.Column(db.String(50))
    assigned_gate = db.Column(db.String(20))
    planned_gate = db.Column(db.String(20))
    
    # Arrival times
    aldt = db.Column(db.DateTime)  # Actual Landing Time
    aibt = db.Column(db.DateTime)  # Actual In-Block Time
    eldt = db.Column(db.DateTime)  # Estimated Landing Time
    eibt = db.Column(db.DateTime)  # Estimated In-Block Time
    
    # Departure times
    aobt = db.Column(db.DateTime)  # Actual Off-Block Time
    atot = db.Column(db.DateTime)  # Actual Take-off Time
    tobt = db.Column(db.DateTime)  # Target Off-Block Time
    ttot = db.Column(db.DateTime)  # Target Take-off Time
    
    # Flight status
    flight_type = db.Column(db.String(10))  # 'arrival' or 'departure'
    status = db.Column(db.String(20), default='scheduled')
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'flight_number': self.flight_number,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'scheduled_time': self.scheduled_time.isoformat() if self.scheduled_time else None,
            'aircraft_registration': self.aircraft_registration,
            'aircraft_type': self.aircraft_type,
            'new_position': self.new_position,
            'old_position': self.old_position,
            'assigned_gate': self.assigned_gate,
            'planned_gate': self.planned_gate,
            'aldt': self.aldt.isoformat() if self.aldt else None,
            'aibt': self.aibt.isoformat() if self.aibt else None,
            'eldt': self.eldt.isoformat() if self.eldt else None,
            'eibt': self.eibt.isoformat() if self.eibt else None,
            'aobt': self.aobt.isoformat() if self.aobt else None,
            'atot': self.atot.isoformat() if self.atot else None,
            'tobt': self.tobt.isoformat() if self.tobt else None,
            'ttot': self.ttot.isoformat() if self.ttot else None,
            'flight_type': self.flight_type,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Gate(db.Model):
    __tablename__ = 'gates'
    
    id = db.Column(db.Integer, primary_key=True)
    gate_number = db.Column(db.String(20), unique=True, nullable=False)
    gate_type = db.Column(db.String(50))  # 'gate', 'hangar', 'ramp'
    
    # Capacity constraints
    max_aircraft = db.Column(db.Integer, default=1)
    aircraft_types = db.Column(db.String(100))  # 'wide_body,narrow_body'
    
    # Location information for passenger distance calculation
    terminal = db.Column(db.String(20))
    concourse = db.Column(db.String(20))
    coordinates_x = db.Column(db.Float)
    coordinates_y = db.Column(db.Float)
    
    # Availability
    is_active = db.Column(db.Boolean, default=True)
    maintenance_status = db.Column(db.String(20), default='available')
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'gate_number': self.gate_number,
            'gate_type': self.gate_type,
            'max_aircraft': self.max_aircraft,
            'aircraft_types': self.aircraft_types.split(',') if self.aircraft_types else [],
            'terminal': self.terminal,
            'concourse': self.concourse,
            'coordinates_x': self.coordinates_x,
            'coordinates_y': self.coordinates_y,
            'is_active': self.is_active,
            'maintenance_status': self.maintenance_status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class Recommendation(db.Model):
    __tablename__ = 'recommendations'
    
    id = db.Column(db.Integer, primary_key=True)
    flight_id = db.Column(db.Integer, db.ForeignKey('flights.id'), nullable=False)
    gate_id = db.Column(db.Integer, db.ForeignKey('gates.id'), nullable=False)
    
    # Optimization scores
    compatibility_score = db.Column(db.Float)
    turnaround_score = db.Column(db.Float)
    distance_score = db.Column(db.Float)
    total_score = db.Column(db.Float)
    
    # Recommendation status
    status = db.Column(db.String(20), default='recommended')  # 'recommended', 'accepted', 'rejected'
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    flight = db.relationship('Flight', backref='recommendations')
    gate = db.relationship('Gate', backref='recommendations')
    
    def to_dict(self):
        return {
            'id': self.id,
            'flight_id': self.flight_id,
            'gate_id': self.gate_id,
            'gate_number': self.gate.gate_number if self.gate else None,
            'compatibility_score': self.compatibility_score,
            'turnaround_score': self.turnaround_score,
            'distance_score': self.distance_score,
            'total_score': self.total_score,
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }

class AirportConfig(db.Model):
    __tablename__ = 'airport_config'
    
    id = db.Column(db.Integer, primary_key=True)
    config_key = db.Column(db.String(100), unique=True, nullable=False)
    config_value = db.Column(db.Text)
    config_type = db.Column(db.String(20))  # 'string', 'number', 'boolean', 'json'
    description = db.Column(db.Text)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'config_key': self.config_key,
            'config_value': self.config_value,
            'config_type': self.config_type,
            'description': self.description,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
