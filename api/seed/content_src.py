"""Editorial copy for the demo catalogue: per-item summaries and per-topic article sections.

Educational sample copy at guideline level (no dosing, no product claims). The client's
medical team replaces all of it with approved content; the engine only selects and orders.
"""

# English title → (EN summary, AR summary)
SUMMARIES = {
    "Glaucoma essentials: reading the optic nerve": (
        "How to recognise glaucomatous cupping, rim thinning and disc haemorrhages, and when imaging adds value.",
        "كيفية التعرف على تقعر القرص البصري وترقق الحافة العصبية والنزف القرصي، ومتى يضيف التصوير قيمة."),
    "Measuring intraocular pressure in clinic": (
        "Applanation technique, common sources of error and how corneal thickness changes the reading.",
        "تقنية قياس الضغط بالتسطيح، ومصادر الخطأ الشائعة، وتأثير سماكة القرنية على القراءة."),
    "When first-line drops are not enough in glaucoma": (
        "A structured approach to adherence, combination therapy and timely referral for laser or surgery.",
        "نهج منظم للالتزام بالعلاج والعلاج المركب والإحالة في الوقت المناسب للعلاج بالليزر أو الجراحة."),
    "Selective laser trabeculoplasty explained": (
        "Who benefits from first-line laser, what to expect after treatment and how long the effect lasts.",
        "من يستفيد من الليزر كخط علاج أول، وما المتوقع بعد العلاج، وكم يدوم تأثيره."),
    "Neovascular AMD: a practical treatment pathway": (
        "From diagnosis to treat-and-extend: structuring injection visits around disease activity.",
        "من التشخيص إلى نظام العلاج والتمديد: تنظيم مواعيد الحقن وفق نشاط المرض."),
    "Reading OCT scans in macular disease": (
        "A systematic way to read retinal layers and spot fluid, atrophy and the signs that change management.",
        "طريقة منهجية لقراءة طبقات الشبكية واكتشاف السوائل والضمور والعلامات التي تغير خطة العلاج."),
    "Product focus: extending anti-VEGF treatment intervals": (
        "Evidence and practical criteria for lengthening intervals between intravitreal injections.",
        "الأدلة والمعايير العملية لإطالة الفترات بين الحقن داخل الجسم الزجاجي."),
    "Dry AMD: what patients ask and how to answer": (
        "Clear answers on progression risk, supplements, lifestyle and monitoring at home.",
        "إجابات واضحة حول خطر تطور المرض والمكملات ونمط الحياة والمتابعة المنزلية."),
    "Diabetic retinopathy screening in primary care": (
        "Setting up retinal screening, grading results and agreeing referral thresholds with eye services.",
        "إعداد برنامج فحص الشبكية وتصنيف النتائج والاتفاق على حدود الإحالة مع خدمات طب العيون."),
    "Diabetic macular oedema: choosing therapy": (
        "Matching treatment to central involvement, visual acuity and the patient's ability to attend visits.",
        "مواءمة العلاج مع إصابة مركز البقعة وحدة الإبصار وقدرة المريض على الالتزام بالزيارات."),
    "Grading retinopathy: a visual guide": (
        "Annotated fundus images from mild non-proliferative disease to proliferative retinopathy.",
        "صور مشروحة لقاع العين من الاعتلال غير التكاثري الخفيف إلى الاعتلال التكاثري."),
    "Product briefing: intravitreal therapy in DME": (
        "Briefing on intravitreal options for diabetic macular oedema and patient selection.",
        "موجز حول خيارات العلاج داخل الجسم الزجاجي للوذمة البقعية السكرية واختيار المرضى."),
    "Dry eye in the digital age": (
        "Screen time, blink rate and the ocular surface: practical advice for patients and clinicians.",
        "وقت الشاشات ومعدل الرمش وسطح العين: نصائح عملية للمرضى والأطباء."),
    "Tear film assessment in five minutes": (
        "A quick, repeatable clinic routine for tear break-up time, staining and symptom scoring.",
        "روتين سريع وقابل للتكرار في العيادة لقياس زمن تفكك الدمع والتلوين وتقييم الأعراض."),
    "Meibomian gland dysfunction: an update": (
        "Current understanding of gland dysfunction and the stepwise treatments now available.",
        "الفهم الحالي لخلل الغدد الميبومية والعلاجات المتدرجة المتاحة."),
    "Glaucoma care: what changed this year": (
        "Earlier laser, new surgical options and home monitoring: the practical changes for clinic.",
        "الليزر المبكر وخيارات جراحية جديدة والمتابعة المنزلية: التغييرات العملية في العيادة."),
    "Hypertension targets: what the latest guidance says": (
        "Office and home targets by age and risk, and how to reach them without over-treating.",
        "الأهداف في العيادة والمنزل حسب العمر ومستوى الخطر، وكيفية بلوغها دون مبالغة في العلاج."),
    "Single-pill combinations for blood pressure": (
        "Why starting with two agents in one pill improves control and adherence.",
        "لماذا يحسن البدء بدواءين في حبة واحدة من السيطرة على الضغط والالتزام بالعلاج."),
    "Home blood pressure monitoring done right": (
        "Device choice, cuff size and a simple seven-day protocol patients can follow.",
        "اختيار الجهاز ومقاس الكفة وبروتوكول بسيط لسبعة أيام يمكن للمرضى اتباعه."),
    "The four pillars of heart failure therapy": (
        "Building guideline-directed therapy for reduced ejection fraction, one pillar at a time.",
        "بناء العلاج الموجه بالإرشادات لقصور القلب مع انخفاض الكسر القذفي، ركيزة تلو الأخرى."),
    "Titrating heart failure medicines safely": (
        "Monitoring potassium, kidney function and blood pressure while reaching target doses.",
        "مراقبة البوتاسيوم ووظائف الكلى وضغط الدم أثناء الوصول إلى الجرعات المستهدفة."),
    "Product focus: SGLT2 inhibition in heart failure": (
        "Overview of the evidence for SGLT2 inhibition across the heart failure spectrum.",
        "نظرة عامة على أدلة استخدام مثبطات SGLT2 عبر طيف قصور القلب."),
    "LDL cholesterol: lower for longer": (
        "Why cumulative LDL exposure matters and how risk category sets the target.",
        "لماذا يهم التعرض التراكمي للكوليسترول الضار وكيف تحدد فئة الخطر الهدف."),
    "Statin intolerance: practical options": (
        "Separating true intolerance from nocebo effects, and the alternatives when statins fail.",
        "التمييز بين عدم التحمل الحقيقي وتأثير التوقع السلبي، والبدائل عند فشل الستاتينات."),
    "Product briefing: PCSK9 therapy in high-risk patients": (
        "Briefing on PCSK9-targeted therapy for patients who remain above target.",
        "موجز حول العلاج المستهدف لـ PCSK9 للمرضى الذين لم يبلغوا الهدف."),
    "Type 2 diabetes: beyond glucose control": (
        "Choosing therapy for heart and kidney protection, not only for HbA1c.",
        "اختيار العلاج لحماية القلب والكلى، وليس لخفض الهيموغلوبين السكري فقط."),
    "Starting injectable therapy in type 2 diabetes": (
        "When to start, how to explain it to patients and how to follow up in the first weeks.",
        "متى نبدأ، وكيف نشرح ذلك للمرضى، وكيف نتابعهم في الأسابيع الأولى."),
    "Fasting and diabetes: a clinician's checklist": (
        "Risk stratification before prolonged fasting, medication adjustment and when to advise against it.",
        "تقييم الخطر قبل الصيام وتعديل الأدوية ومتى ننصح بعدم الصيام."),
    "Kidney protection in diabetes": (
        "Screening for albuminuria and the therapies that slow decline in kidney function.",
        "الكشف عن البيلة الألبومينية والعلاجات التي تبطئ تراجع وظائف الكلى."),
    "Resistant hypertension work-up": (
        "Confirming true resistance and screening for secondary causes before adding agents.",
        "التأكد من المقاومة الحقيقية والبحث عن الأسباب الثانوية قبل إضافة أدوية جديدة."),
    "Echo basics for the non-cardiologist": (
        "Reading the key numbers on an echo report and what they mean for daily practice.",
        "قراءة الأرقام الرئيسية في تقرير تخطيط صدى القلب وما تعنيه في الممارسة اليومية."),
    "Lipoprotein(a): who should be tested": (
        "A once-in-a-lifetime test that reclassifies risk, and how to act on the result.",
        "فحص يُجرى مرة واحدة في العمر يعيد تصنيف الخطر، وكيفية التصرف بناءً على النتيجة."),
    "Asthma control in five questions": (
        "A short consultation framework to assess control, risk and inhaler use.",
        "إطار قصير للاستشارة لتقييم السيطرة على الربو والخطر وطريقة استخدام البخاخ."),
    "Inhaler technique: common mistakes": (
        "The errors we see most often with each device type and how to correct them.",
        "الأخطاء الأكثر شيوعاً مع كل نوع من أجهزة الاستنشاق وكيفية تصحيحها."),
    "Severe asthma and biologic therapy": (
        "Identifying severe asthma, phenotyping and referral for biologic treatment.",
        "التعرف على الربو الشديد وتحديد النمط الظاهري والإحالة للعلاج البيولوجي."),
    "Product briefing: maintenance and reliever therapy": (
        "Briefing on single-inhaler maintenance and reliever regimens.",
        "موجز حول نظام البخاخ الواحد للعلاج الوقائي والمسعف."),
    "COPD exacerbations: prevention first": (
        "Vaccination, inhaled therapy and rehabilitation to reduce exacerbations and admissions.",
        "التطعيم والعلاج بالاستنشاق وإعادة التأهيل للحد من النوبات ودخول المستشفى."),
    "Pulmonary rehabilitation in practice": (
        "What a programme includes, who should be referred and the outcomes to expect.",
        "ما يتضمنه البرنامج، ومن يجب إحالته، والنتائج المتوقعة."),
    "Triple inhaled therapy: who benefits": (
        "Selecting patients for triple therapy using exacerbation history and eosinophil count.",
        "اختيار المرضى للعلاج الثلاثي بناءً على تاريخ النوبات وعدد الحمضات."),
    "Product focus: once-daily triple inhaler": (
        "Overview of a once-daily triple inhaler option for patients with frequent exacerbations.",
        "نظرة عامة على خيار البخاخ الثلاثي مرة واحدة يومياً للمرضى ذوي النوبات المتكررة."),
    "RSV in older adults: the hidden burden": (
        "Why RSV is under-recognised in adults and which patients are most at risk.",
        "لماذا لا يُشخَّص الفيروس المخلوي التنفسي بما يكفي لدى البالغين ومن هم الأكثر عرضة للخطر."),
    "Adult RSV vaccination: evidence review": (
        "What the trials show on efficacy, duration of protection and safety.",
        "ما تظهره التجارب حول الفعالية ومدة الحماية والسلامة."),
    "Seasonal respiratory vaccines: a planning guide": (
        "Scheduling influenza, COVID-19, pneumococcal and RSV vaccines across the season.",
        "جدولة لقاحات الإنفلونزا وكوفيد-19 والمكورات الرئوية والفيروس المخلوي خلال الموسم."),
    "Asthma in pregnancy": (
        "Keeping asthma controlled in pregnancy and reassuring patients about inhaled treatment.",
        "الحفاظ على السيطرة على الربو أثناء الحمل وطمأنة المريضات بشأن العلاج بالاستنشاق."),
    "Spirometry interpretation made simple": (
        "A stepwise read of the flow-volume loop, ratios and reversibility testing.",
        "قراءة متدرجة لمنحنى التدفق والحجم والنسب واختبار قابلية الانعكاس."),
    "Talking to patients about vaccines": (
        "Short, evidence-based conversations that address common concerns.",
        "محادثات قصيرة مبنية على الأدلة تعالج المخاوف الشائعة."),
    "Paediatric wheeze: when is it asthma?": (
        "Distinguishing viral wheeze from asthma in young children.",
        "التمييز بين الأزيز الفيروسي والربو لدى الأطفال الصغار."),
    "Breathlessness clinic: a case series": (
        "Four cases that show how to work up chronic breathlessness efficiently.",
        "أربع حالات توضح كيفية تقييم ضيق التنفس المزمن بكفاءة."),
    "Migraine prevention: choosing the first drug": (
        "When prevention is indicated and how to match the first option to the patient.",
        "متى تكون الوقاية مطلوبة وكيف نختار الخيار الأول المناسب للمريض."),
    "CGRP pathway therapies explained": (
        "How CGRP-targeted treatments work and where they fit in the pathway.",
        "كيف تعمل العلاجات المستهدفة لمسار CGRP وأين موقعها في خطة العلاج."),
    "Medication overuse headache": (
        "Recognising overuse, planning withdrawal and preventing relapse.",
        "التعرف على الإفراط في استخدام المسكنات والتخطيط للتوقف ومنع الانتكاس."),
    "Product briefing: monthly migraine prevention": (
        "Briefing on monthly preventive treatment for episodic and chronic migraine.",
        "موجز حول العلاج الوقائي الشهري للصداع النصفي العرضي والمزمن."),
    "New seizure classification in practice": (
        "Applying the current classification to describe seizures clearly in clinic letters.",
        "تطبيق التصنيف الحالي لوصف النوبات بوضوح في التقارير الطبية."),
    "Choosing antiseizure medication": (
        "Matching the first medicine to seizure type, comorbidities and life stage.",
        "مواءمة الدواء الأول مع نوع النوبة والأمراض المصاحبة ومرحلة الحياة."),
    "Epilepsy in women of childbearing age": (
        "Contraception, pregnancy planning and medication choice for women with epilepsy.",
        "منع الحمل والتخطيط للحمل واختيار الدواء للنساء المصابات بالصرع."),
    "Early treatment in relapsing MS": (
        "Why early disease-modifying therapy matters and how treatment is escalated.",
        "لماذا يهم البدء المبكر بالعلاج المعدل لمسار المرض وكيف يتم تصعيد العلاج."),
    "MRI monitoring in multiple sclerosis": (
        "When to repeat MRI and which findings signal disease activity.",
        "متى نعيد التصوير بالرنين المغناطيسي وأي النتائج تدل على نشاط المرض."),
    "Product focus: high-efficacy MS therapy": (
        "Overview of a high-efficacy option for patients with active relapsing MS.",
        "نظرة عامة على خيار عالي الفعالية للمرضى المصابين بالتصلب المتعدد الانتكاسي النشط."),
    "Migraine and fasting": (
        "Why fasting triggers attacks and practical steps to reduce them.",
        "لماذا يحفز الصيام النوبات وخطوات عملية للحد منها."),
    "Status epilepticus: the first 30 minutes": (
        "A time-based protocol for the emergency management of prolonged seizures.",
        "بروتوكول زمني للتعامل الإسعافي مع النوبات المطولة."),
    "Fatigue in MS: assessment tools": (
        "Measuring fatigue, finding contributing causes and options that help.",
        "قياس الإرهاق والبحث عن الأسباب المساهمة والخيارات المفيدة."),
    "Headache red flags": (
        "The features that call for urgent investigation of a new headache.",
        "العلامات التي تستدعي فحصاً عاجلاً عند ظهور صداع جديد."),
    "Driving and epilepsy: counselling patients": (
        "How to discuss driving safely and the principles behind local regulations.",
        "كيفية مناقشة القيادة بأمان والمبادئ التي تستند إليها الأنظمة المحلية."),
    "Living with MS: patient perspectives": (
        "Patients describe diagnosis, treatment decisions and daily life with MS.",
        "يتحدث المرضى عن التشخيص وقرارات العلاج والحياة اليومية مع التصلب المتعدد."),
    "Menopause: identification and management": (
        "Recognising the menopause transition and offering individualised management.",
        "التعرف على مرحلة انقطاع الطمث وتقديم خطة علاج فردية."),
    "Hormone therapy: balancing benefit and risk": (
        "Discussing benefits and risks of hormone therapy by age, timing and route.",
        "مناقشة فوائد ومخاطر العلاج الهرموني حسب العمر والتوقيت وطريقة الإعطاء."),
    "Non-hormonal options for hot flushes": (
        "Evidence-based alternatives for women who cannot or prefer not to use hormones.",
        "بدائل مبنية على الأدلة للنساء اللواتي لا يستطعن أو لا يرغبن في استخدام الهرمونات."),
    "Product focus: low-dose menopausal therapy": (
        "Overview of a low-dose option for vasomotor symptoms.",
        "نظرة عامة على خيار منخفض الجرعة لأعراض الهبات الساخنة."),
    "Contraceptive counselling in ten minutes": (
        "A structured consultation that covers effectiveness, preferences and safety.",
        "استشارة منظمة تغطي الفعالية والتفضيلات والسلامة."),
    "Long-acting reversible contraception": (
        "Implants and intrauterine methods: suitability, insertion and follow-up.",
        "الغرسات والوسائل داخل الرحم: الملاءمة والتركيب والمتابعة."),
    "Contraception with chronic conditions": (
        "Using medical eligibility criteria for women with hypertension, migraine or diabetes.",
        "استخدام معايير الأهلية الطبية للنساء المصابات بارتفاع الضغط أو الصداع النصفي أو السكري."),
    "Fracture risk assessment after menopause": (
        "Combining risk factors, risk calculators and bone density to decide on treatment.",
        "الجمع بين عوامل الخطر وحاسبات الخطر وكثافة العظام لاتخاذ قرار العلاج."),
    "Bone density scans: reading the report": (
        "T-scores, Z-scores and the sites that matter when interpreting a DXA report.",
        "قراءة مؤشري T وZ والمواقع المهمة عند تفسير تقرير فحص كثافة العظام."),
    "Product briefing: anabolic bone therapy": (
        "Briefing on anabolic treatment for patients at very high fracture risk.",
        "موجز حول العلاج البنائي للمرضى ذوي الخطر المرتفع جداً للكسور."),
    "Vitamin D and calcium: what to advise": (
        "Who needs supplementation, sensible intake and when to check levels.",
        "من يحتاج إلى المكملات، والكميات المناسبة، ومتى نفحص المستويات."),
    "Menopause and cardiovascular risk": (
        "How cardiovascular risk changes after menopause and what to review at midlife.",
        "كيف يتغير خطر أمراض القلب بعد انقطاع الطمث وما يجب مراجعته في منتصف العمر."),
    "Emergency contraception: a quick guide": (
        "Options, timing and follow-up after unprotected intercourse.",
        "الخيارات والتوقيت والمتابعة بعد العلاقة غير المحمية."),
    "Genitourinary syndrome of menopause": (
        "Recognising vaginal and urinary symptoms and the local treatments that help.",
        "التعرف على الأعراض المهبلية والبولية والعلاجات الموضعية المفيدة."),
    "Treatment holidays in osteoporosis": (
        "When a pause in bisphosphonate therapy is reasonable and how to monitor it.",
        "متى يكون التوقف المؤقت عن البيسفوسفونات مناسباً وكيف تتم المتابعة."),
    "Contraception counselling for young people": (
        "Confidential, age-appropriate counselling and choosing a method that fits.",
        "مشورة سرية ومناسبة للعمر واختيار الوسيلة الملائمة."),
}

# Topic → list of (EN heading, EN text, AR heading, AR text). Articles in a topic draw
# four sections in a rotating order, after their own lead paragraph.
SECTIONS = {
    "glaucoma": [
        ("Who is at risk", "Age, family history, high myopia and raised intraocular pressure are the strongest risk factors. Many patients have no symptoms until visual field loss is advanced, which is why opportunistic checks matter.",
         "من هم الأكثر عرضة", "يعد التقدم في العمر والتاريخ العائلي وقصر النظر الشديد وارتفاع ضغط العين أقوى عوامل الخطر. لا تظهر الأعراض لدى كثير من المرضى حتى يتقدم فقدان المجال البصري، ولذلك يكتسب الفحص العرضي أهمية كبيرة."),
        ("Assessment", "A full assessment combines pressure measurement, gonioscopy, optic disc examination and visual field testing. Optical coherence tomography helps document the nerve fibre layer over time.",
         "التقييم", "يجمع التقييم الكامل بين قياس الضغط وفحص زاوية العين وفحص القرص البصري واختبار المجال البصري. ويساعد التصوير المقطعي البصري على توثيق طبقة الألياف العصبية مع مرور الوقت."),
        ("Treatment principles", "Lowering pressure is the only proven way to slow progression. A target pressure is set for each patient and reviewed if the disease continues to progress.",
         "مبادئ العلاج", "خفض الضغط هو الطريقة الوحيدة المثبتة لإبطاء تطور المرض. ويُحدَّد ضغط مستهدف لكل مريض ويُراجَع إذا استمر المرض في التقدم."),
        ("Adherence", "Up to half of patients do not use drops as prescribed. Simple regimens, instillation training and regular review of technique improve outcomes.",
         "الالتزام بالعلاج", "لا يستخدم ما يصل إلى نصف المرضى القطرات كما وُصفت لهم. وتحسّن الأنظمة البسيطة والتدريب على وضع القطرات والمراجعة المنتظمة للطريقة من النتائج."),
        ("Follow-up", "Review frequency depends on stage and stability. Progression on fields or imaging should prompt a change in the target or the treatment.",
         "المتابعة", "يعتمد تكرار المراجعة على مرحلة المرض واستقراره. ويستدعي التطور في المجال البصري أو التصوير تغيير الهدف أو العلاج."),
    ],
    "amd": [
        ("Recognising the disease", "Early disease is often found on routine examination as drusen and pigment change. Sudden distortion or central blur suggests neovascular disease and needs prompt referral.",
         "التعرف على المرض", "غالباً ما يُكتشف المرض في مراحله المبكرة أثناء الفحص الروتيني على شكل ترسبات وتغيرات صبغية. ويشير التشوه المفاجئ أو ضبابية الرؤية المركزية إلى النوع الرطب ويتطلب إحالة عاجلة."),
        ("Imaging", "OCT is the key test for both diagnosis and monitoring. It shows fluid in or under the retina and guides decisions at each visit.",
         "التصوير", "يعد التصوير المقطعي البصري الفحص الأساسي للتشخيص والمتابعة، إذ يُظهر السوائل داخل الشبكية أو تحتها ويوجّه القرارات في كل زيارة."),
        ("Treatment", "Intravitreal anti-VEGF therapy is the standard of care for neovascular disease. Regimens aim to control activity while keeping the number of visits manageable.",
         "العلاج", "يعد العلاج بمضادات عامل النمو البطاني داخل الجسم الزجاجي المعيار الأساسي للنوع الرطب. وتهدف أنظمة العلاج إلى السيطرة على نشاط المرض مع إبقاء عدد الزيارات في حدود معقولة."),
        ("Living with low vision", "Low-vision aids, good lighting and early referral to support services help patients stay independent.",
         "التعايش مع ضعف البصر", "تساعد وسائل ضعف البصر والإضاءة الجيدة والإحالة المبكرة إلى خدمات الدعم المرضى على الحفاظ على استقلاليتهم."),
        ("Self-monitoring", "Patients can check each eye with a grid at home and should know how to seek review quickly if their vision changes.",
         "المتابعة الذاتية", "يمكن للمرضى فحص كل عين بشبكة أمسلر في المنزل، ويجب أن يعرفوا كيفية طلب المراجعة بسرعة إذا تغيرت رؤيتهم."),
    ],
    "diabetic_retinopathy": [
        ("Screening", "Regular retinal photography detects sight-threatening disease before symptoms appear. Screening intervals depend on previous results and glycaemic control.",
         "الفحص الدوري", "يكشف التصوير المنتظم للشبكية المرض المهدد للبصر قبل ظهور الأعراض. وتعتمد الفترات بين الفحوص على النتائج السابقة ومستوى ضبط السكر."),
        ("Systemic control", "Better control of glucose, blood pressure and lipids reduces the risk of progression. Rapid falls in HbA1c can transiently worsen retinopathy and need closer review.",
         "ضبط العوامل الجهازية", "يقلل ضبط السكر وضغط الدم والدهون من خطر تطور المرض. وقد يؤدي الانخفاض السريع في الهيموغلوبين السكري إلى تفاقم مؤقت يستدعي متابعة أدق."),
        ("Macular oedema", "Central-involving oedema with reduced vision is usually treated with intravitreal therapy. Laser and steroids remain options in selected patients.",
         "الوذمة البقعية", "تُعالج الوذمة التي تصيب مركز البقعة مع انخفاض الإبصار عادةً بالحقن داخل الجسم الزجاجي. ويبقى الليزر والستيرويدات خيارات لمرضى مختارين."),
        ("Referral", "Clear referral criteria shared between primary care and eye services shorten the time to treatment.",
         "الإحالة", "تختصر معايير الإحالة الواضحة والمشتركة بين الرعاية الأولية وخدمات طب العيون الوقت اللازم لبدء العلاج."),
        ("Proliferative disease", "New vessels on the disc or elsewhere need urgent treatment with laser or intravitreal therapy to prevent haemorrhage.",
         "المرض التكاثري", "تتطلب الأوعية الجديدة على القرص البصري أو في مواضع أخرى علاجاً عاجلاً بالليزر أو بالحقن لمنع النزف."),
    ],
    "dry_eye": [
        ("A common complaint", "Dry eye is one of the most frequent reasons for eye visits. Symptoms often do not match signs, so a structured history is essential.",
         "شكوى شائعة", "يعد جفاف العين من أكثر أسباب زيارة طبيب العيون شيوعاً. وكثيراً ما لا تتوافق الأعراض مع العلامات السريرية، لذا يعد التاريخ المرضي المنظم أمراً ضرورياً."),
        ("Two main mechanisms", "Most patients have evaporative disease linked to meibomian gland dysfunction, aqueous deficiency or a mix of both.",
         "آليتان رئيسيتان", "يعاني معظم المرضى من الجفاف التبخري المرتبط بخلل الغدد الميبومية، أو من نقص إفراز الدمع، أو من مزيج من الاثنين."),
        ("Stepwise management", "Treatment moves from environmental advice and lubricants to lid care, anti-inflammatory drops and in-office procedures.",
         "العلاج المتدرج", "يتدرج العلاج من النصائح البيئية والمرطبات إلى العناية بالجفون وقطرات مضادة للالتهاب والإجراءات في العيادة."),
        ("Screens and blinking", "Prolonged screen use reduces blink rate and completeness. Regular breaks and screen position help.",
         "الشاشات والرمش", "يقلل الاستخدام المطول للشاشات من معدل الرمش واكتماله. وتساعد الاستراحات المنتظمة وضبط موضع الشاشة على التخفيف."),
    ],
    "hypertension": [
        ("Diagnosis", "Confirm raised clinic readings with home or ambulatory monitoring before starting lifelong treatment.",
         "التشخيص", "يجب تأكيد القراءات المرتفعة في العيادة بالقياس المنزلي أو المتنقل قبل بدء علاج مدى الحياة."),
        ("Targets", "Most adults benefit from a lower target if treatment is tolerated. Targets are individualised for frailty and postural symptoms.",
         "الأهداف", "يستفيد معظم البالغين من هدف أقل إذا كان العلاج محتملاً، مع تكييف الأهداف لدى كبار السن الضعفاء ومن يعانون أعراض انخفاض الضغط الوضعي."),
        ("Treatment strategy", "Combination therapy, ideally in a single pill, reaches target faster than sequential monotherapy.",
         "استراتيجية العلاج", "يصل العلاج المركب، ويفضل أن يكون في حبة واحدة، إلى الهدف أسرع من التبديل المتتابع بين الأدوية المفردة."),
        ("Lifestyle", "Salt reduction, weight loss, activity and limiting alcohol add meaningfully to drug therapy.",
         "نمط الحياة", "يضيف تقليل الملح وخفض الوزن والنشاط البدني والحد من الكحول فائدة ملموسة إلى العلاج الدوائي."),
        ("Follow-up", "Review monthly until controlled, then at least yearly with renal function and cardiovascular risk assessment.",
         "المتابعة", "تتم المراجعة شهرياً حتى تتحقق السيطرة، ثم سنوياً على الأقل مع تقييم وظائف الكلى وخطر أمراض القلب."),
    ],
    "heart_failure": [
        ("Classification", "Ejection fraction defines the phenotype and determines which therapies have proven benefit.",
         "التصنيف", "يحدد الكسر القذفي النمط الظاهري للمرض والعلاجات التي ثبتت فائدتها."),
        ("Guideline-directed therapy", "For reduced ejection fraction, four drug classes reduce mortality and admissions. Starting them early matters more than perfect sequencing.",
         "العلاج الموجه بالإرشادات", "في حالة انخفاض الكسر القذفي، تقلل أربع فئات دوائية من الوفيات ودخول المستشفى. والبدء المبكر بها أهم من الترتيب المثالي."),
        ("Monitoring", "Check symptoms, weight, blood pressure, kidney function and potassium at each step of titration.",
         "المراقبة", "تتم مراقبة الأعراض والوزن وضغط الدم ووظائف الكلى والبوتاسيوم في كل خطوة من خطوات تعديل الجرعة."),
        ("After discharge", "An early review within two weeks of discharge reduces readmission.",
         "بعد الخروج من المستشفى", "تقلل المراجعة المبكرة خلال أسبوعين من الخروج من خطر العودة إلى المستشفى."),
    ],
    "lipids": [
        ("Risk first", "Lipid targets follow cardiovascular risk category. Patients with established disease have the lowest targets.",
         "الخطر أولاً", "تتبع أهداف الدهون فئة خطر أمراض القلب، ويكون الهدف الأدنى للمرضى المصابين بمرض قائم."),
        ("Statins", "High-intensity statins remain first line. Adherence falls quickly, so early follow-up and lipid checks help.",
         "الستاتينات", "تبقى الستاتينات عالية الشدة الخط الأول. وينخفض الالتزام بها سريعاً، لذا تساعد المتابعة المبكرة وفحص الدهون."),
        ("Beyond statins", "Ezetimibe, PCSK9-targeted therapy and other agents help patients who remain above target.",
         "ما بعد الستاتينات", "يساعد الإيزيتيمايب والعلاجات المستهدفة لـ PCSK9 وأدوية أخرى المرضى الذين لم يبلغوا الهدف."),
        ("Familial hypercholesterolaemia", "Very high LDL or early family history should prompt assessment for an inherited cause and cascade testing.",
         "فرط كوليسترول الدم العائلي", "يستدعي الارتفاع الشديد في الكوليسترول الضار أو التاريخ العائلي المبكر تقييم السبب الوراثي وفحص الأقارب."),
    ],
    "type2_diabetes": [
        ("Individualised targets", "HbA1c targets balance benefit against hypoglycaemia risk, age and comorbidity.",
         "أهداف فردية", "توازن أهداف الهيموغلوبين السكري بين الفائدة وخطر هبوط السكر والعمر والأمراض المصاحبة."),
        ("Organ protection", "Some glucose-lowering classes reduce cardiovascular events and slow kidney disease, independent of their effect on glucose.",
         "حماية الأعضاء", "تقلل بعض فئات أدوية السكر من أحداث القلب والأوعية وتبطئ أمراض الكلى بشكل مستقل عن تأثيرها على السكر."),
        ("Weight", "Weight management is central to treatment and can lead to remission in some patients.",
         "الوزن", "يعد التحكم في الوزن محوراً أساسياً في العلاج وقد يؤدي إلى هدأة المرض لدى بعض المرضى."),
        ("Annual review", "Eyes, feet, kidneys and cardiovascular risk should be reviewed at least once a year.",
         "المراجعة السنوية", "يجب مراجعة العينين والقدمين والكلى وخطر أمراض القلب مرة واحدة على الأقل سنوياً."),
        ("Education", "Structured education improves self-management and confidence.",
         "التثقيف", "يحسن التثقيف المنظم من قدرة المريض على إدارة مرضه ومن ثقته بنفسه."),
    ],
    "asthma": [
        ("Assessing control", "Ask about daytime symptoms, night waking, reliever use and activity limitation. Poor control is common and often under-reported.",
         "تقييم السيطرة", "اسأل عن الأعراض النهارية والاستيقاظ الليلي واستخدام البخاخ المسعف والحد من النشاط. ويشيع ضعف السيطرة وكثيراً ما لا يُبلَّغ عنه."),
        ("Inhaled corticosteroids", "Every patient with asthma should receive inhaled corticosteroid-containing treatment. Reliever-only therapy increases the risk of severe attacks.",
         "الستيرويدات المستنشقة", "يجب أن يتلقى كل مريض بالربو علاجاً يحتوي على الستيرويدات المستنشقة، إذ يزيد الاعتماد على المسعف وحده من خطر النوبات الشديدة."),
        ("Technique", "Check technique at every visit before stepping up treatment.",
         "طريقة الاستخدام", "تحقق من طريقة استخدام البخاخ في كل زيارة قبل تصعيد العلاج."),
        ("Action plans", "A written action plan helps patients recognise and respond to worsening control.",
         "خطط العمل", "تساعد خطة العمل المكتوبة المرضى على التعرف على تراجع السيطرة والتصرف حياله."),
        ("Referral", "Refer patients with frequent exacerbations despite good adherence for specialist assessment.",
         "الإحالة", "يُحال المرضى الذين يعانون نوبات متكررة رغم الالتزام الجيد إلى تقييم متخصص."),
    ],
    "copd": [
        ("Diagnosis", "Spirometry confirms airflow limitation. Symptom burden and exacerbation history guide treatment.",
         "التشخيص", "يؤكد قياس التنفس وجود انسداد مجرى الهواء، ويوجّه عبء الأعراض وتاريخ النوبات اختيار العلاج."),
        ("Non-drug measures", "Stopping smoking, vaccination and pulmonary rehabilitation have the largest impact on outcomes.",
         "التدابير غير الدوائية", "للإقلاع عن التدخين والتطعيم وإعادة التأهيل الرئوي التأثير الأكبر على النتائج."),
        ("Inhaled therapy", "Long-acting bronchodilators are the foundation; inhaled steroids are added for selected patients with exacerbations and raised eosinophils.",
         "العلاج بالاستنشاق", "تشكل موسعات القصبات طويلة المفعول الأساس، وتضاف الستيرويدات المستنشقة لمرضى مختارين لديهم نوبات وارتفاع في الحمضات."),
        ("Exacerbations", "Each exacerbation accelerates decline. Early recognition and a rescue plan reduce admissions.",
         "النوبات الحادة", "تسرّع كل نوبة من تراجع وظائف الرئة، ويقلل التعرف المبكر وخطة الإسعاف من دخول المستشفى."),
    ],
    "rsv_vaccination": [
        ("Burden in adults", "RSV causes significant illness in older adults and people with heart or lung disease, but is rarely tested for.",
         "العبء لدى البالغين", "يسبب الفيروس المخلوي التنفسي مرضاً ملحوظاً لدى كبار السن ومرضى القلب والرئة، لكنه نادراً ما يُفحص."),
        ("Vaccines", "Adult RSV vaccines reduce lower respiratory tract disease in the first seasons after vaccination.",
         "اللقاحات", "تقلل لقاحات الفيروس المخلوي للبالغين من التهابات الجهاز التنفسي السفلي في المواسم الأولى بعد التطعيم."),
        ("Who to prioritise", "Recommendations focus on older adults and those with chronic conditions; local guidance sets the age threshold.",
         "الفئات ذات الأولوية", "تركز التوصيات على كبار السن والمصابين بأمراض مزمنة، وتحدد الإرشادات المحلية الحد العمري."),
        ("Co-administration", "RSV vaccine can be planned alongside other seasonal vaccines in line with local guidance.",
         "الإعطاء المتزامن", "يمكن التخطيط لإعطاء لقاح الفيروس المخلوي مع اللقاحات الموسمية الأخرى وفق الإرشادات المحلية."),
    ],
    "migraine": [
        ("Diagnosis", "Migraine is a clinical diagnosis. Red flags should be excluded before attributing headache to migraine.",
         "التشخيص", "الصداع النصفي تشخيص سريري، ويجب استبعاد العلامات التحذيرية قبل نسب الصداع إليه."),
        ("Acute treatment", "Treat early in the attack with an effective dose; combination with an antiemetic helps some patients.",
         "العلاج الحاد", "يُعالج في بداية النوبة بجرعة فعالة، ويستفيد بعض المرضى من إضافة مضاد للقيء."),
        ("Prevention", "Consider prevention when attacks are frequent or disabling. Several drug classes and CGRP-targeted options are available.",
         "الوقاية", "تُدرس الوقاية عندما تكون النوبات متكررة أو معيقة، وتتوفر عدة فئات دوائية وخيارات مستهدفة لمسار CGRP."),
        ("Triggers", "Irregular sleep, missed meals and dehydration are common triggers that patients can manage.",
         "المحفزات", "يعد اضطراب النوم وتفويت الوجبات والجفاف من المحفزات الشائعة التي يمكن للمرضى التحكم بها."),
        ("Overuse", "Frequent use of acute medicines can itself cause daily headache.",
         "الإفراط في الاستخدام", "قد يؤدي الاستخدام المتكرر لأدوية النوبة الحادة بحد ذاته إلى صداع يومي."),
    ],
    "epilepsy": [
        ("Classification", "Describe onset, awareness and motor features; this guides investigation and treatment.",
         "التصنيف", "يُوصف بدء النوبة ومستوى الوعي والمظاهر الحركية، وهذا يوجّه الفحوص والعلاج."),
        ("First medicine", "Choose by seizure type, side-effect profile, interactions and plans for pregnancy.",
         "الدواء الأول", "يُختار حسب نوع النوبة والآثار الجانبية والتداخلات الدوائية وخطط الحمل."),
        ("Safety", "Discuss driving, bathing, heights and sudden unexpected death in epilepsy in a supportive way.",
         "السلامة", "تُناقش القيادة والاستحمام والمرتفعات وخطر الوفاة المفاجئة في الصرع بأسلوب داعم."),
        ("Drug-resistant epilepsy", "Failure of two appropriate medicines should prompt referral to a specialist centre.",
         "الصرع المقاوم للأدوية", "يستدعي فشل دواءين مناسبين الإحالة إلى مركز متخصص."),
    ],
    "multiple_sclerosis": [
        ("Diagnosis", "Diagnosis rests on clinical findings and MRI showing lesions disseminated in space and time.",
         "التشخيص", "يعتمد التشخيص على المعطيات السريرية والتصوير بالرنين المغناطيسي الذي يُظهر آفات منتشرة في المكان والزمان."),
        ("Disease-modifying therapy", "Early treatment reduces relapses and new lesions. Options range from moderate to high efficacy.",
         "العلاج المعدل لمسار المرض", "يقلل العلاج المبكر من الانتكاسات والآفات الجديدة، وتتراوح الخيارات بين متوسطة وعالية الفعالية."),
        ("Monitoring", "Regular clinical review and MRI identify breakthrough activity and the need to escalate.",
         "المتابعة", "تكشف المراجعة السريرية المنتظمة والتصوير النشاط المستمر للمرض والحاجة إلى تصعيد العلاج."),
        ("Symptom management", "Fatigue, bladder symptoms, spasticity and mood need attention alongside disease control.",
         "علاج الأعراض", "يحتاج الإرهاق وأعراض المثانة والتشنج والمزاج إلى اهتمام إلى جانب السيطرة على المرض."),
    ],
    "menopause": [
        ("Diagnosis", "In women over 45 with typical symptoms, menopause is a clinical diagnosis without hormone tests.",
         "التشخيص", "لدى النساء فوق 45 عاماً مع أعراض نموذجية، يُشخّص انقطاع الطمث سريرياً دون الحاجة إلى تحاليل هرمونية."),
        ("Symptoms", "Vasomotor symptoms, sleep disturbance, mood change and genitourinary symptoms affect quality of life.",
         "الأعراض", "تؤثر الهبات الساخنة واضطراب النوم وتقلب المزاج والأعراض البولية التناسلية على جودة الحياة."),
        ("Hormone therapy", "For most symptomatic women under 60, benefits outweigh risks. Route and regimen are individualised.",
         "العلاج الهرموني", "تفوق الفوائد المخاطر لدى معظم النساء المصابات بالأعراض دون سن الستين، ويُكيَّف طريق الإعطاء والنظام لكل امرأة."),
        ("Long-term health", "Midlife is an opportunity to review bone health and cardiovascular risk.",
         "الصحة على المدى الطويل", "تمثل مرحلة منتصف العمر فرصة لمراجعة صحة العظام وخطر أمراض القلب."),
        ("Alternatives", "Non-hormonal medicines and cognitive behavioural therapy help when hormones are not suitable.",
         "البدائل", "تساعد الأدوية غير الهرمونية والعلاج المعرفي السلوكي عندما لا تكون الهرمونات مناسبة."),
    ],
    "contraception": [
        ("Effectiveness", "Long-acting methods are the most effective because they do not depend on daily use.",
         "الفعالية", "تعد الوسائل طويلة المفعول الأكثر فعالية لأنها لا تعتمد على الاستخدام اليومي."),
        ("Medical eligibility", "Eligibility criteria guide safe choices for women with conditions such as hypertension or migraine with aura.",
         "الأهلية الطبية", "توجّه معايير الأهلية الاختيارات الآمنة للنساء المصابات بحالات مثل ارتفاع الضغط أو الصداع النصفي المصحوب بأورة."),
        ("Counselling", "Discuss preferences, side effects, return to fertility and non-contraceptive benefits.",
         "المشورة", "تُناقش التفضيلات والآثار الجانبية وعودة الخصوبة والفوائد غير المرتبطة بمنع الحمل."),
        ("Follow-up", "Plan follow-up for blood pressure checks and method review.",
         "المتابعة", "يُخطط للمتابعة لقياس ضغط الدم ومراجعة الوسيلة."),
    ],
    "osteoporosis": [
        ("Risk assessment", "Combine clinical risk factors with a validated calculator and bone density where needed.",
         "تقييم الخطر", "يُجمع بين عوامل الخطر السريرية وحاسبة معتمدة وقياس كثافة العظام عند الحاجة."),
        ("Treatment", "Bisphosphonates are first line for most patients; anabolic agents are used for very high risk.",
         "العلاج", "تعد البيسفوسفونات الخط الأول لمعظم المرضى، وتُستخدم العلاجات البنائية للخطر المرتفع جداً."),
        ("Falls prevention", "Strength and balance training, medication review and home safety reduce fractures.",
         "الوقاية من السقوط", "يقلل تدريب القوة والتوازن ومراجعة الأدوية وسلامة المنزل من الكسور."),
        ("Monitoring", "Review adherence and reassess risk after three to five years of treatment.",
         "المتابعة", "تُراجع درجة الالتزام ويعاد تقييم الخطر بعد ثلاث إلى خمس سنوات من العلاج."),
        ("Nutrition", "Adequate calcium and vitamin D support treatment, particularly in those with low intake.",
         "التغذية", "يدعم تناول كميات كافية من الكالسيوم وفيتامين د العلاج، خاصة لدى من يقل لديهم الاستهلاك."),
    ],
}
