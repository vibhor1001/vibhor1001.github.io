# Spec v7 — Partner-model messaging (Houst-style, two personas, automated backend,
# white-label ops, dedicated account manager, UK-wide → Europe).
HUB = ["become-a-partner/index.html"]

SPECS = [
    # ── site-wide nav strings ──
    dict(id="pm-mega-partner-blurb", category="partner-messaging", files=None, expect=(40, 60),
         find="A genuine 50/50 partnership for operators ready to scale without the day-to-day.",
         replace="A genuine 50/50 partnership — for hosts who want their time back, and agents who'd rather sell than operate."),
    dict(id="pm-mega-onboarding", category="partner-messaging", files=None, expect=(40, 60),
         find="Go live quickly, with support.",
         replace="Go live quickly — your account manager runs it from day one."),

    # ── partner hub ──
    dict(id="pm-hub-audience", category="partner-messaging", files=HUB, expect=(1, 1),
         find="No industry experience needed. We train every Partner on exactly how to find landlords and win management deals.",
         replace="Hosting your own lets today? Managing for landlords? Starting from zero? All three work. We train every Partner on exactly how to find landlords and win management deals."),
    dict(id="pm-hub-dashboard", category="partner-messaging", files=HUB, expect=(1, 1),
         find="As a Partner you still run everything on the PropertyFlow PMS — with one difference: your dashboard shows how revenue is distributed automatically across every property.",
         replace="As a Partner you get the PropertyFlow PMS with a fully automated back office behind it — and a dedicated account manager running the day-to-day of every property. Your dashboard simply shows the results: bookings, operations and the revenue split, live."),
    dict(id="pm-hub-focus-sales", category="partner-messaging", files=HUB, expect=(1, 1),
         find="You run full management on the PMS and own the client relationships. We handle every ground operation, front the costs and take care of all the admin — so you can focus on landing more properties.",
         replace="You own the clients, the relationships and the growth. Our automated backend and your dedicated account manager run the day-to-day — every ground operation handled, costs fronted, admin done — so you can focus on landing more properties."),
    dict(id="pm-hub-jsonld-scope", category="partner-messaging", files=HUB, expect=(1, 1),
         find="runs cleaning, linen, maintenance and compliance",
         replace="runs cleaning, linen, changeovers, logistics, maintenance and compliance"),

    # ── subpages ──
    dict(id="pm-wwlf-personas", category="partner-messaging",
         files=["become-a-partner/what-we-look-for/index.html"], expect=(1, 2),
         find="Partnership suits operators scaling beyond what one person can run day to day.",
         replace="Partnership suits hosts who want the running of their own lets off their plate, and agents scaling beyond what one person can run day to day."),
    dict(id="pm-apply-portfolio-1", category="partner-messaging",
         files=["become-a-partner/apply/index.html"], expect=(1, 3),
         find="Tell us about your portfolio and we'll take it from there.",
         replace="Tell us about your portfolio — current or planned — and we'll take it from there."),
    dict(id="pm-apply-portfolio-2", category="partner-messaging",
         files=["become-a-partner/apply/index.html"], expect=(1, 2),
         find="How many properties, where, and how they run today.",
         replace="How many properties, where, and how they run today — or the portfolio you plan to win."),
    dict(id="pm-ytb-account-manager", category="partner-messaging",
         files=["become-a-partner/your-time-back/index.html"], expect=(1, 1),
         find="As a Partner, the operation simply isn't yours to run anymore.",
         replace="As a Partner, the operation simply isn't yours to run anymore — your dedicated account manager runs it for you."),
    dict(id="pm-rts-uk-europe", category="partner-messaging",
         files=["become-a-partner/room-to-scale/index.html"], expect=(1, 2),
         find="We handle the rest, at any size",
         replace="We handle the rest, at any size — across the UK today, with Europe on the roadmap"),

    # ── homepage + pricing + hands-free ──
    dict(id="pm-home-partner-lead", category="partner-messaging", files=["index.html"], expect=(1, 1),
         find="Become a verified Partner and you get a whole operations company behind you: we take on the graft on the ground and the backend, back you with the tools and training to win, and split the upside 50/50. Your job is guests and growth.",
         replace="Become a verified Partner and you get a whole operations company behind you: our automated backend and your dedicated account manager take on the graft on the ground and the admin, we back you with the tools and training to win — and we split the upside 50/50. Your job is guests and growth."),
    dict(id="pm-pricing-account-manager", category="partner-messaging", files=["pricing/index.html"], expect=(1, 1),
         find="Dedicated partner team",
         replace="Dedicated account manager"),
    dict(id="pm-handsfree-jsonld", category="partner-messaging", files=["platform/hands-free/index.html"], expect=(1, 2),
         find="Vetted local partners handle cleaning, maintenance, guest check-in, and property care. You approve the strategy, they execute.",
         replace="PropertyFlow's own operations network handles cleaning, linen, changeovers, maintenance and guest care nationwide, coordinated by your dedicated account manager. You approve the strategy; we execute."),
]
