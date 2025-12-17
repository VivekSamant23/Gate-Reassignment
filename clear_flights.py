#!/usr/bin/env python3
"""Clear all flights and recommendations from the database."""

import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from app import app, db
from models import Flight, Recommendation

with app.app_context():
    Flight.query.delete()
    Recommendation.query.delete()
    db.session.commit()
    print('All flight and recommendation data cleared.')
