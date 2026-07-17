# Spec v4 — retries with corrected literal strings.
SPECS = [
    dict(id="areaserved-city-2", category="bugfix", files=["about/index.html"], expect=(1, 1),
         find='"areaServed": {\n        "@type": "City",\n        "name": "United Kingdom",',
         replace='"areaServed": {\n        "@type": "Country",\n        "name": "United Kingdom",'),
    dict(id="home-demo-cleaner-2", category="uk-wide", files=["index.html"], expect=(1, 1),
         find="Cleaner assigned · Edinburgh",
         replace="Cleaner assigned · Glasgow"),
    dict(id="home-demo-booking-2", category="uk-wide", files=["index.html"], expect=(1, 1),
         find="Edinburgh · £1,240 · 4 nights",
         replace="Manchester · £1,240 · 4 nights"),
]
