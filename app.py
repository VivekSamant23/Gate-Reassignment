from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime
from dotenv import load_dotenv

from extensions import db
from models import Flight, Gate, Recommendation, AirportConfig
from recommendation_engine import RecommendationEngine
from data_integration import DataIntegration

load_dotenv()

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///gate_reassignment.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

# Initialize components
recommendation_engine = RecommendationEngine()
data_integration = DataIntegration()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/api/flights', methods=['GET'])
def get_flights():
    try:
        date = request.args.get('date')
        flights = data_integration.get_flights(date)
        return jsonify({"flights": flights})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/recommendations', methods=['POST'])
def generate_recommendations():
    try:
        data = request.get_json()
        flight_ids = data.get('flight_ids', [])
        recommendations = recommendation_engine.generate_recommendations(flight_ids)
        return jsonify({"recommendations": recommendations})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/assign', methods=['POST'])
def assign_gates():
    try:
        data = request.get_json()
        assignments = data.get('assignments', [])
        result = data_integration.update_gate_assignments(assignments)
        return jsonify({"success": True, "updated": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/config', methods=['GET', 'POST'])
def manage_config():
    if request.method == 'GET':
        try:
            config = data_integration.get_airport_config()
            return jsonify({"config": config})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        try:
            data = request.get_json()
            result = data_integration.update_airport_config(data)
            return jsonify({"success": True, "updated": result})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_flight_data():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        result = data_integration.process_uploaded_file(file)
        return jsonify({"success": True, "processed": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
