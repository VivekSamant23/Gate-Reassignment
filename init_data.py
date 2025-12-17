#!/usr/bin/env python3
"""
Initialize the gate reassignment system with default data
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app
from extensions import db
from data_integration import DataIntegration

def initialize_system():
    """Initialize the system with default configuration and gate data"""
    with app.app_context():
        print("Creating database tables...")
        db.create_all()
        
        print("Initializing default configuration...")
        data_integration = DataIntegration()
        data_integration.initialize_default_config()
        
        print("Initializing default gates...")
        data_integration.initialize_default_gates()
        
        print("System initialization complete!")
        print("Default gates created:")
        print("- Gates A1, A2, A3 (Terminal A)")
        print("- Gates B1, B2 (Terminal B)")
        print("- Hangar H1 (can accommodate 3 aircraft)")
        print("- Ramp R1 (can accommodate 2 aircraft)")
        print("\nDefault configuration created for AODB/GMS API endpoints")
        print("Update the configuration through the web interface or .env file")

if __name__ == "__main__":
    initialize_system()
