"""Items opened in the presenter script get their own article body, not the shared topic sections.

English title -> list of (EN heading, EN text, AR heading, AR text)
"""

UNIQUE_BODIES = {
    "Glaucoma essentials: reading the optic nerve": [
        ("The healthy disc", "A normal optic disc has a pink, even neuroretinal rim that is usually thickest inferiorly, then superiorly, nasally and temporally. Comparing both eyes is the quickest way to spot asymmetry, which is often the first clue.",
         "القرص السليم", "يتميز القرص البصري الطبيعي بحافة عصبية شبكية وردية منتظمة تكون عادة أسمك في الأسفل ثم الأعلى ثم الجهة الأنفية ثم الصدغية. وتعد مقارنة العينين أسرع طريقة لاكتشاف عدم التناظر الذي يكون غالباً أول مؤشر."),
        ("Signs of glaucomatous damage", "Look for focal or diffuse rim thinning, notching, an enlarging cup, disc haemorrhages at the rim margin and a visible defect in the nerve fibre layer. A cup-to-disc ratio alone is not diagnostic because large discs have large cups.",
         "علامات التلف الزرقي", "ابحث عن ترقق موضعي أو منتشر في الحافة، وعن التثلم، وتوسع التقعر، والنزف عند حافة القرص، وعيوب طبقة الألياف العصبية. ولا تكفي نسبة التقعر إلى القرص وحدها للتشخيص لأن الأقراص الكبيرة تحتوي على تقعر كبير."),
        ("When imaging helps", "Optical coherence tomography quantifies the nerve fibre layer and ganglion cell complex, and is most useful for detecting change over time. Interpret results alongside the clinical picture, since artefacts and myopic discs can mislead.",
         "متى يفيد التصوير", "يقيس التصوير المقطعي البصري طبقة الألياف العصبية ومركب الخلايا العقدية، ويكون أكثر فائدة في رصد التغير مع الوقت. ويجب تفسير النتائج في ضوء الصورة السريرية لأن الشوائب الفنية وأقراص قصر النظر قد تكون مضللة."),
    ],
    "When first-line drops are not enough in glaucoma": [
        ("Check the basics first", "Before adding medication, confirm the patient is using the drops, with the right technique and timing. Many apparent treatment failures are adherence or instillation problems.",
         "تحقق من الأساسيات أولاً", "قبل إضافة دواء جديد، تأكد من أن المريض يستخدم القطرات بالطريقة والتوقيت الصحيحين، فكثير من حالات الفشل الظاهري ترجع إلى مشكلات الالتزام أو طريقة وضع القطرات."),
        ("Adding or switching", "If pressure remains above target, switch class when the first drug is ineffective, or add a second class when it works but not enough. Fixed combinations reduce the number of drops and help adherence.",
         "الإضافة أو التبديل", "إذا بقي الضغط فوق الهدف، يُستبدل الدواء بفئة أخرى عندما يكون الأول غير فعال، أو تضاف فئة ثانية عندما يكون فعالاً بدرجة غير كافية. وتقلل التركيبات الثابتة من عدد القطرات وتساعد على الالتزام."),
        ("Laser and surgery", "Selective laser trabeculoplasty is effective at any stage of open-angle glaucoma. Refer for surgery when progression continues despite maximal tolerated treatment.",
         "الليزر والجراحة", "يعد رأب التربيق الانتقائي بالليزر فعالاً في أي مرحلة من مراحل الزرق مفتوح الزاوية. وتتم الإحالة للجراحة عند استمرار التطور رغم أقصى علاج يمكن تحمله."),
    ],
    "Neovascular AMD: a practical treatment pathway": [
        ("Fast-track referral", "New distortion or a sudden drop in central vision in an older adult needs assessment within days. Outcomes depend strongly on the vision at the start of treatment.",
         "الإحالة العاجلة", "يحتاج ظهور تشوه جديد أو انخفاض مفاجئ في الرؤية المركزية لدى كبار السن إلى تقييم خلال أيام، إذ تعتمد النتائج بدرجة كبيرة على حدة الإبصار عند بدء العلاج."),
        ("Loading and extending", "Treatment usually starts with monthly injections, then intervals are extended step by step while the macula stays dry on OCT, and shortened if fluid returns.",
         "مرحلة التحميل والتمديد", "يبدأ العلاج عادة بحقن شهرية، ثم تُمدد الفترات تدريجياً ما دامت البقعة جافة في التصوير المقطعي، وتُقصّر إذا عادت السوائل."),
        ("Keeping patients in care", "Missed visits are the main cause of lost vision in real-world practice. Clear explanations, reminders and predictable scheduling make a measurable difference.",
         "استمرار المرضى في العلاج", "تعد الزيارات الفائتة السبب الرئيسي لفقدان البصر في الممارسة الفعلية، ويحدث الشرح الواضح والتذكير والمواعيد المنتظمة فرقاً ملموساً."),
    ],
    "Glaucoma care: what changed this year": [
        ("Earlier laser", "Evidence continues to support selective laser trabeculoplasty as a first-line option, sparing many patients the burden of daily drops.",
         "الليزر في وقت أبكر", "تواصل الأدلة دعم رأب التربيق الانتقائي بالليزر كخيار أول، مما يجنب كثيراً من المرضى عبء القطرات اليومية."),
        ("Minimally invasive surgery", "Microinvasive procedures are widening the options between drops and traditional surgery, particularly when combined with cataract surgery.",
         "الجراحة طفيفة التوغل", "توسع الإجراءات طفيفة التوغل الخيارات المتاحة بين القطرات والجراحة التقليدية، خاصة عند دمجها مع جراحة الساد."),
        ("Home monitoring", "Home tonometry and remote visual field testing are being evaluated to detect pressure peaks and progression between clinic visits.",
         "المتابعة المنزلية", "يجري تقييم قياس ضغط العين في المنزل واختبار المجال البصري عن بُعد لرصد ارتفاعات الضغط والتطور بين زيارات العيادة."),
    ],
    "Hypertension targets: what the latest guidance says": [
        ("Why lower is better", "Large trials show that lowering systolic pressure reduces stroke, heart failure and cardiovascular death, with benefit seen across age groups when treatment is tolerated.",
         "لماذا الأقل أفضل", "تُظهر التجارب الكبيرة أن خفض الضغط الانقباضي يقلل من السكتة الدماغية وقصور القلب والوفاة القلبية، مع فائدة في مختلف الفئات العمرية عند تحمل العلاج."),
        ("Measuring properly", "Use a validated device, the correct cuff and repeated seated readings. Home readings confirm the diagnosis and reveal white-coat and masked hypertension.",
         "القياس الصحيح", "استخدم جهازاً معتمداً وكفة بالمقاس الصحيح وقراءات متكررة في وضعية الجلوس. وتؤكد القراءات المنزلية التشخيص وتكشف ارتفاع الضغط المرتبط بالعيادة والمقنع."),
        ("Individualising the target", "Frail patients, those with postural symptoms and people with limited life expectancy may need a more cautious target agreed with them.",
         "تكييف الهدف", "قد يحتاج المرضى الضعفاء ومن يعانون أعراض انخفاض الضغط الوضعي ومن لديهم توقعات حياة محدودة إلى هدف أكثر تحفظاً يُتفق عليه معهم."),
    ],
    "The four pillars of heart failure therapy": [
        ("The four classes", "For reduced ejection fraction, the pillars are a renin-angiotensin system inhibitor or ARNI, a beta-blocker, a mineralocorticoid receptor antagonist and an SGLT2 inhibitor.",
         "الفئات الأربع", "في حالة انخفاض الكسر القذفي، تتمثل الركائز في مثبط لنظام الرينين والأنجيوتنسين أو ARNI، وحاصر بيتا، ومضاد لمستقبلات القشرانيات المعدنية، ومثبط SGLT2."),
        ("Start early, then optimise", "Starting all four at low doses within weeks gives more benefit than perfecting one drug at a time. Doses are then increased as blood pressure, heart rate and kidney function allow.",
         "البدء المبكر ثم التحسين", "يحقق البدء بالفئات الأربع بجرعات منخفضة خلال أسابيع فائدة أكبر من تحسين دواء واحد في كل مرة، ثم تُرفع الجرعات بحسب ما يسمح به ضغط الدم ونبض القلب ووظائف الكلى."),
        ("Common barriers", "Low blood pressure, rising creatinine and hyperkalaemia are often manageable without stopping therapy. Small changes in potassium or creatinine are expected after starting treatment.",
         "العوائق الشائعة", "غالباً ما يمكن التعامل مع انخفاض الضغط وارتفاع الكرياتينين وفرط البوتاسيوم دون إيقاف العلاج، إذ يُتوقع حدوث تغيرات بسيطة في البوتاسيوم أو الكرياتينين بعد البدء."),
    ],
    "LDL cholesterol: lower for longer": [
        ("Cumulative exposure", "Atherosclerosis reflects the total LDL burden over time. Lowering LDL earlier and keeping it low produces greater benefit than the same reduction later in life.",
         "التعرض التراكمي", "يعكس تصلب الشرايين العبء الكلي للكوليسترول الضار عبر الزمن، ويحقق خفضه مبكراً والحفاظ عليه منخفضاً فائدة أكبر من الخفض نفسه في مرحلة متأخرة."),
        ("Targets by risk", "Patients at very high risk have the lowest targets. Absolute and percentage reductions should both be checked at follow-up.",
         "الأهداف حسب الخطر", "يكون الهدف الأدنى للمرضى ذوي الخطر المرتفع جداً، ويجب التحقق من الانخفاض المطلق والنسبي عند المتابعة."),
        ("Reaching target", "High-intensity statins come first, then ezetimibe, then further agents for patients who remain above target despite good adherence.",
         "الوصول إلى الهدف", "تأتي الستاتينات عالية الشدة أولاً، ثم الإيزيتيمايب، ثم أدوية إضافية للمرضى الذين يبقون فوق الهدف رغم الالتزام الجيد."),
    ],
    "Type 2 diabetes: beyond glucose control": [
        ("A shift in priorities", "Treatment choice now starts with comorbidities. In established cardiovascular disease, heart failure or chronic kidney disease, agents with proven organ protection are preferred.",
         "تغير الأولويات", "يبدأ اختيار العلاج اليوم بالأمراض المصاحبة، ففي وجود مرض قلبي وعائي قائم أو قصور قلب أو مرض كلوي مزمن تُفضل الأدوية ذات الحماية المثبتة للأعضاء."),
        ("Weight as a target", "Meaningful weight loss improves glycaemia, blood pressure and lipids, and can lead to remission in some people early in the disease.",
         "الوزن كهدف علاجي", "يحسن فقدان الوزن الملحوظ مستوى السكر وضغط الدم والدهون، وقد يؤدي إلى هدأة المرض لدى بعض المرضى في مراحله المبكرة."),
        ("Avoiding harm", "Reduce hypoglycaemia risk by reviewing sulfonylureas and insulin, particularly in older adults and those with kidney disease.",
         "تجنب الضرر", "قلل خطر هبوط السكر بمراجعة السلفونيل يوريا والإنسولين، خاصة لدى كبار السن ومرضى الكلى."),
    ],
}
