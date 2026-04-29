export const JURISDICTION_CONTEXT = {
  ENGLISH_LAW: `
Jurisdiction: England and Wales
Governing legislation: Landlord and Tenant Act 1954 (security of tenure), Landlord and Tenant Act 1988 (consent to assign), Landlord and Tenant (Covenants) Act 1995, RICS Code for Leasing Business Premises 2020.
Market standards:
- Institutional leases are typically FRI (fully repairing and insuring) with tenant bearing all costs
- Standard lease terms: 5-15 years with 5-year rent review cycles
- Rent reviews typically upward-only to open market value — flag any departure from this
- Service charge: RICS code compliance expected, with tenant audit rights
- Alienation: landlord consent not to be unreasonably withheld is statutory under LTA 1988
- Break clauses: heavily negotiated, compliance conditions must be strictly met
- Security of tenure: LTA 1954 protection is default — contracting out requires court order or statutory procedure
- Authorised guarantee agreements (AGAs) on assignment are standard
- SDLT and registration requirements apply to leases over 7 years
- "Institutional" lease: full repairing, upward-only rent review, no break, full alienation controls
Scoring calibration: Score clauses against RICS Code and institutional market norms. Upward-only rent review is standard (bias 3), unrestricted break without conditions is tenant-friendly (bias 4-5), any departure from FRI towards gross lease terms is tenant-friendly.
`,

  ROMANIAN_LAW: `
Jurisdiction: Romania
Governing legislation: Romanian Civil Code (Codul Civil) 2011 — Articles 1777-1850 on lease (locaţiune), Law 227/2015 (Fiscal Code) for VAT on rent, Law 50/1991 for construction and use permits.
Market standards:
- Commercial leases in Romania are typically shorter than Western European norms: 3-7 years for office, 5-10 for retail/industrial
- Bilingual leases (Romanian/English) are common for international tenants — analyse English text only, flag language inconsistencies as "x"
- Rent typically indexed to EUR/USD with RON payment at exchange rate — flag currency risk clauses
- VAT on commercial rent is 19% — VAT opt-in/opt-out provisions are significant
- Service charges: less standardised than UK, often bundled into rent or loosely defined
- Romanian law requires written form for leases over 1 year; registration with ANAF required for tax purposes
- Security deposits: typically 3 months rent, regulated return obligations under Civil Code
- Landlord termination rights in Romanian leases are often broader than Western norms — scrutinise carefully
- Force majeure provisions are more commonly invoked and more broadly defined in Romanian law
- GDPR compliance provisions increasingly common in international leases
Scoring calibration: Romanian market norms are generally more landlord-favourable than UK/US. A clause that scores 3 in English law may score 2 in a Romanian context. Calibrate accordingly. Flag any clause that violates mandatory Romanian Civil Code provisions as "x".
`,

  NEW_YORK: `
Jurisdiction: New York, USA
Governing legislation: New York Real Property Law, New York City Administrative Code (for NYC leases), New York UCC Article 2-A (personal property leases only).
Market standards:
- NYC commercial leases are typically 5-20 years; longer terms for anchor tenants
- Net leases (NNN) common for retail; gross or modified gross for office
- Rent stabilisation does NOT apply to commercial leases
- Yellowstone injunctions: tenants can seek to toll cure periods — landlords often try to limit this right, flag any waiver as landlord-favourable
- Personal guarantees from principals are extremely common and often aggressively drafted — flag unlimited or unconditional guarantees
- Rent escalations: fixed percentage (typically 3% annually) or CPI — flag any escalation above 4% as landlord-favourable
- Assignment/subletting: landlord consent standard, but NY courts require good faith — Dress Barn doctrine applies
- Workletter/build-out: tenant improvement allowances are negotiated, absence is landlord-favourable
- Security deposits: no statutory cap for commercial leases in NY unlike residential
- SNDA (Subordination, Non-Disturbance and Attornment): tenants should always negotiate NDA protection
- NYC-specific: Local Law 97 carbon emissions compliance increasingly allocated to tenants — flag this
Scoring calibration: NYC market is sophisticated and heavily negotiated. Absence of NDA, unlimited personal guarantee, and above-market escalation are all clearly landlord-favourable. Standard net lease terms score 3.
`,

  CALIFORNIA: `
Jurisdiction: California, USA
Governing legislation: California Civil Code Sections 1941-1952.7 (landlord-tenant), Civil Code Section 1995.010-1995.340 (assignment/subletting), Civil Code Section 1717 (attorney fees), California Code of Civil Procedure Section 1263.510 (condemnation/goodwill).
Market standards:
- Commercial leases: NNN common for retail/industrial, modified gross or full-service gross for office
- Typical terms: 3-10 years for office/retail, 5-15 for industrial
- Proposition 13 reassessment protections: tax increase pass-throughs triggered by sale should be excluded or capped — flag any unlimited tax pass-through as landlord-favourable
- Assignment: Civil Code 1995.260 requires landlord not unreasonably withhold consent — statutory right, any clause purporting to allow absolute discretion is void
- Attorney fees: Civil Code 1717 makes one-sided fee clauses mutual by operation of law — flag as informational, not necessarily landlord-favourable
- Condemnation: Civil Code 1263.510 gives tenants right to claim business goodwill separately — any waiver is landlord-favourable
- ADA compliance: landlord typically responsible for base building, tenant for premises — flag any clause shifting ADA base building liability to tenant
- CAM charges: California tenants commonly negotiate audit rights, caps, and exclusions for capital expenditures
- Security deposits: Civil Code 1950.7 requires return within 30 days of termination with itemised statement — flag any clause inconsistent with this
- Hazardous materials: Proposition 65 disclosure obligations on landlord — flag any clause shifting this to tenant
Scoring calibration: California law is generally more tenant-protective than other US states. What is standard in Texas or Florida may be landlord-favourable in California. Apply California statutory protections as baseline for neutral scoring.
`,
};
