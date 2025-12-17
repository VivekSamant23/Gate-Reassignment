from flask import Flask, request, jsonify, send_file
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

# SQLite can appear to "hang" when the DB is locked or accessed across threads.
if str(app.config['SQLALCHEMY_DATABASE_URI']).startswith('sqlite:'):
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'connect_args': {
            'check_same_thread': False,
            'timeout': 15
        }
    }

# Initialize database
db.init_app(app)

# Initialize components
recommendation_engine = RecommendationEngine()
data_integration = DataIntegration()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/api/admin/reset-db', methods=['POST'])
def reset_db():
    try:
        if request.remote_addr not in ('127.0.0.1', '::1'):
            return jsonify({"error": "Forbidden"}), 403
        db.session.remove()
        db.drop_all()
        db.create_all()
        return jsonify({"success": True, "message": "Database schema reset (drop_all/create_all) completed."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/flights', methods=['GET', 'POST', 'DELETE'])
def flights():
    if request.method == 'GET':
        try:
            flights = data_integration.get_flights()
            return jsonify(flights)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    elif request.method == 'POST':
        try:
            flight_data = request.json
            flight = data_integration.create_flight(flight_data)
            return jsonify(flight), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    elif request.method == 'DELETE':
        try:
            from models import Flight, Recommendation
            Flight.query.delete()
            Recommendation.query.delete()
            db.session.commit()
            return jsonify({"success": True, "message": "All flights and recommendations cleared."})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/recommendations', methods=['POST'])
def generate_recommendations():
    try:
        data = request.get_json()
        flight_ids = data.get('flight_ids', [])
        recs = recommendation_engine.generate_recommendations(flight_ids)

        # Return the best (top-scoring) gate per flight as a simple mapping
        best_by_flight = {}
        for rec in recs:
            fid = rec.get('flight_id')
            if fid is None:
                continue
            if fid not in best_by_flight:
                best_by_flight[fid] = rec.get('gate_number')

        return jsonify({"recommendations": best_by_flight, "details": recs})
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
            gates = [g.to_dict() for g in Gate.query.order_by(Gate.gate_number.asc()).all()]
            return jsonify({"config": config, "gates": gates})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        try:
            data = request.get_json()
            # Support GUI gates editor: payload { gates: [...] }
            if isinstance(data, dict) and isinstance(data.get('gates'), list):
                updated = 0
                for g in data.get('gates'):
                    if not isinstance(g, dict):
                        continue
                    gate_number = g.get('gate_number')
                    if not gate_number:
                        continue

                    gate = Gate.query.filter_by(gate_number=gate_number).first()
                    if not gate:
                        gate = Gate(gate_number=gate_number)
                        db.session.add(gate)

                    gate.gate_type = g.get('gate_type')
                    gate.max_aircraft = g.get('max_aircraft')
                    aircraft_types = g.get('aircraft_types')
                    if isinstance(aircraft_types, list):
                        gate.aircraft_types = ','.join(aircraft_types)
                    else:
                        gate.aircraft_types = aircraft_types
                    gate.terminal = g.get('terminal')
                    gate.concourse = g.get('concourse')
                    gate.coordinates_x = g.get('coordinates_x')
                    gate.coordinates_y = g.get('coordinates_y')
                    updated += 1

                db.session.commit()
                return jsonify({"success": True, "updated": updated})

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
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        import os, tempfile, logging
        logging.basicConfig(level=logging.INFO)
        logger = logging.getLogger(__name__)
        logger.info("Upload started: %s", file.filename)
        
        # Save to a temporary file to avoid in-memory hangs
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        logger.info("File saved to temp: %s", tmp_path)
        
        try:
            result = data_integration.process_uploaded_file_path(tmp_path)
            logger.info("Processing completed: %s", result)
            return jsonify({"success": True, **result})
        finally:
            os.unlink(tmp_path)
            logger.info("Temp file removed")
    except ValueError as ve:
        # Validation errors (missing columns, bad format, etc.)
        import logging
        logging.getLogger(__name__).error("Validation error: %s", ve)
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        # Log unexpected errors for debugging
        import traceback, sys, logging
        logger = logging.getLogger(__name__)
        logger.error("Upload failed: %s", e)
        traceback.print_exc()
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@app.route('/api/template/<filename>')
def download_template(filename):
    """Download flight data template files"""
    try:
        template_dir = os.path.join(os.path.dirname(__file__), 'templates')
        file_path = os.path.join(template_dir, filename)
        
        if not os.path.exists(file_path):
            return jsonify({"error": "Template file not found"}), 404
        
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5001)
