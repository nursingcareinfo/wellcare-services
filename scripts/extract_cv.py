#!/usr/bin/env python3
"""Extract staff data from CV image using Gemini API"""

import os
import sys
import base64
import json
import re
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Installing google-genai...")
    os.system(f"{sys.executable} -m pip install google-genai -q")
    from google import genai
    from google.genai import types

# Read image
img_path = sys.argv[1] if len(sys.argv) > 1 else "assets/rukhsanacv.jpeg"
with open(img_path, "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY not set")
    sys.exit(1)

# Try reading from .env.local if not in environment
if not api_key or api_key == "your-key-here":
    env_path = Path(__file__).parent.parent / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                api_key = line.split("=", 1)[1].strip()
                break

client = genai.Client(api_key=api_key)

extraction_schema = {
    "type": "OBJECT",
    "properties": {
        "identity": {
            "type": "OBJECT",
            "properties": {
                "fullName": {"type": "STRING"},
                "fatherHusbandName": {"type": "STRING"},
                "cnicNumber": {"type": "STRING"},
                "dateOfBirth": {"type": "STRING"},
                "gender": {"type": "STRING", "enum": ["Male", "Female", "Other"]},
                "maritalStatus": {
                    "type": "STRING",
                    "enum": ["Single", "Married", "Divorced"],
                },
                "mobileNumber": {"type": "STRING"},
                "whatsappNumber": {"type": "STRING"},
                "religion": {"type": "STRING"},
                "emergencyContact": {
                    "type": "OBJECT",
                    "properties": {
                        "name": {"type": "STRING"},
                        "relationship": {"type": "STRING"},
                        "phone": {"type": "STRING"},
                    },
                },
            },
        },
        "professional_profile": {
            "type": "OBJECT",
            "properties": {
                "positionApplied": {"type": "STRING"},
                "experienceYears": {"type": "NUMBER"},
                "shiftPreference": {"type": "STRING"},
                "topSkills": {"type": "ARRAY", "items": {"type": "STRING"}},
            },
        },
        "geographic_data": {
            "type": "OBJECT",
            "properties": {
                "areaTown": {"type": "STRING"},
                "district": {"type": "STRING"},
                "completeAddress": {"type": "STRING"},
            },
        },
        "financial_reference": {
            "type": "OBJECT",
            "properties": {
                "expectedSalaryPKR": {"type": "NUMBER"},
                "preferredPayment": {"type": "STRING"},
                "bankDetails": {"type": "OBJECT"},
            },
        },
        "audit_metadata": {
            "type": "OBJECT",
            "properties": {
                "acknowledgmentSigned": {"type": "BOOLEAN"},
                "policyCheck": {"type": "STRING"},
                "criticalMissingInfo": {"type": "BOOLEAN"},
                "missingFieldsList": {"type": "ARRAY", "items": {"type": "STRING"}},
                "dataConfidence": {"type": "STRING"},
            },
        },
    },
}

prompt = """Extract all information from this CV/resume for a nursing/healthcare staff registration form.

Extract:
1. Full legal name
2. Father's or husband's name
3. CNIC number (XXXXX-XXXXXXX-X format)
4. Date of birth (YYYY-MM-DD)
5. Gender (Male/Female/Other)
6. Marital status (Single/Married/Divorced)
7. Mobile number (+92 format)
8. WhatsApp number (+92 format)
9. Full address
10. Position applied for
11. Years of experience
12. Skills
13. Education
14. Expected salary

Return as JSON matching the schema provided. If a field is not visible, return null."""

try:
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
                ]
            }
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json", response_schema=extraction_schema
        ),
    )

    if response.text:
        cleaned = response.text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```json\s*", "", cleaned)
            cleaned = re.sub(r"```$", "", cleaned)

        data = json.loads(cleaned)
        print(json.dumps(data, indent=2))

        # Output as SQL INSERT
        identity = data.get("identity", {})
        profile = data.get("professional_profile", {})
        geo = data.get("geographic_data", {})
        financial = data.get("financial_reference", {})
        audit = data.get("audit_metadata", {})

        print("\n--- SUPABASE INSERT ---\n")
        print(
            json.dumps(
                {
                    "full_name": identity.get("fullName"),
                    "father_husband_name": identity.get("fatherHusbandName"),
                    "cnic_number": identity.get("cnicNumber"),
                    "dob": identity.get("dateOfBirth"),
                    "gender": identity.get("gender"),
                    "marital_status": identity.get("maritalStatus"),
                    "phone_primary": identity.get("mobileNumber"),
                    "whatsapp_number": identity.get("whatsappNumber"),
                    "religion": identity.get("religion"),
                    "district": geo.get("district"),
                    "complete_address": geo.get("completeAddress"),
                    "position_applied": profile.get("positionApplied"),
                    "experience_years": profile.get("experienceYears"),
                    "shift_preference": profile.get("shiftPreference"),
                    "expected_salary_pkr": financial.get("expectedSalaryPKR"),
                    "preferred_payment_method": financial.get("preferredPayment"),
                    "is_active": True,
                    "is_available": True,
                    "is_acknowledgment_signed": audit.get(
                        "acknowledgmentSigned", False
                    ),
                    "data_confidence": audit.get("dataConfidence", "High"),
                    "critical_missing_info": audit.get("criticalMissingInfo", False),
                },
                indent=2,
            )
        )
    else:
        print("No response from Gemini")

except Exception as e:
    print(f"Error: {e}")
