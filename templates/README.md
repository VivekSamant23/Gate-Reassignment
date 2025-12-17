# Flight Data Upload Template

This directory contains template files for uploading flight data to the Gate Reassignment system.

## Files

- **flight_upload_template.csv** - CSV template for flight data
- **flight_upload_template.xlsx** - Excel template for flight data

## Required Columns

| Column | Description | Example |
|--------|-------------|---------|
| flight_number | Flight identifier | AA123 |
| scheduled_date | Date of flight (YYYY-MM-DD) | 2025-12-18 |
| scheduled_time | Scheduled time (HH:MM) | 08:00 |
| aircraft_registration | Aircraft registration number | N12345A |
| aircraft_type | Aircraft type (narrow_body or wide_body) | narrow_body |
| new_position | New ramp position (optional) | A10 |
| old_position | Previous ramp position (optional) | A10 |
| assigned_gate | Currently assigned gate | A10 |
| planned_gate | Planned gate from GMS | A10 |
| flight_type | Flight type (arrival or departure) | arrival |
| status | Flight status (scheduled, delayed, cancelled) | scheduled |

## Usage

1. Download either the CSV or Excel template
2. Fill in your flight data
3. Upload the file using the Upload page in the application
4. The system will process and import the flight data

## Notes

- All required columns must be filled
- Aircraft type must be either "narrow_body" or "wide_body"
- Flight type must be either "arrival" or "departure"
- Date format must be YYYY-MM-DD
- Time format must be HH:MM (24-hour format)
