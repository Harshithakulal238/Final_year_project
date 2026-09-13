import json
import sys


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_label(value):
    if value is None:
        return ''
    return str(value).strip().lower()


def score_scheme(user, scheme):
    scheme_name = scheme.get('scheme_name') or scheme.get('schemeName') or scheme.get('name') or ''
    text = ' '.join(
        str(v)
        for v in [
            scheme_name,
            scheme.get('description', ''),
            scheme.get('objective', ''),
            scheme.get('benefits', ''),
            scheme.get('eligibility', ''),
            scheme.get('implementing_agency', ''),
            scheme.get('categories', ''),
        ]
    ).lower()

    base = 0.5

    age = safe_float(user.get('age'))
    if age:
        base += 0.08 if age >= 18 and age <= 60 else 0.02

    income = user.get('income')
    income_value = safe_float(str(income).replace('₹', '').replace(',', '').replace('lakh', '').replace('lac', '').strip(), 0)
    if income_value:
        base += 0.08 if income_value <= 1000000 else 0.03

    gender = normalize_label(user.get('gender'))
    if 'female' in text and gender in {'female', 'woman', 'women'}:
        base += 0.12
    elif 'male' in text and gender in {'male', 'man', 'men'}:
        base += 0.12

    caste = normalize_label(user.get('casteCategory') or user.get('caste') or '')
    if 'sc' in text and 'sc' in caste:
        base += 0.12
    elif 'st' in text and 'st' in caste:
        base += 0.12
    elif 'minority' in text and any(item in caste for item in ['muslim', 'christian', 'sikh', 'jain', 'parsi', 'buddhist']):
        base += 0.12

    employment = normalize_label(user.get('employmentType') or user.get('occupation') or '')
    if 'farmer' in text and 'agriculture' in employment:
        base += 0.12
    elif 'student' in text and (user.get('studentStatus') == 'Yes' or user.get('studentStatus') == 'yes'):
        base += 0.12

    district = normalize_label(user.get('district') or '')
    if 'karnataka' in text and district:
        base += 0.04

    qualification = normalize_label(user.get('qualification') or user.get('education') or '')
    if '8th' in text and ('8th' in qualification or '10th' in qualification or '12th' in qualification or 'degree' in qualification):
        base += 0.08
    elif 'scholarship' in text and ('degree' in qualification or 'graduate' in qualification or '12th' in qualification):
        base += 0.08

    if 'disabled' in text and 'disabled' in normalize_label(user.get('specialConditions') or ''):
        base += 0.1

    if 'loan' in text and (user.get('employmentType') in {'Unemployed', 'Self-Employed', 'Private'} or 'unemployed' in employment):
        base += 0.04

    if base > 1.0:
        base = 1.0
    if base < 0.0:
        base = 0.0

    return round(base, 4)


def main():
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print('[]')
            return

        payload = json.loads(raw)
        user = payload.get('user', {})
        schemes = payload.get('schemes', [])

        results = []
        for scheme in schemes:
            score = score_scheme(user, scheme)
            results.append({
                'source_url': scheme.get('source_url') or scheme.get('scheme_url') or scheme.get('schemeName') or scheme.get('scheme_name') or 'unknown',
                'decisionTreeScore': score,
            })

        print(json.dumps(results))
    except Exception:
        print('[]')


if __name__ == '__main__':
    main()