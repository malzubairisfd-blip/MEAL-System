import dayjs from 'dayjs';
import 'dayjs/locale/ar';

function arabicNumber(num: number | string) {
  if (num === null || num === undefined) return '';
  return String(num).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

function excelSerialToDate(serial: number | string) {
    if (typeof serial === 'string') return serial;
    if (typeof serial !== 'number' || isNaN(serial)) return '........';
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
    if (serial > 59) {
        date.setDate(date.getDate() - 1);
    }
    return dayjs(date).format('YYYY/MM/DD');
}

export function getContractHtml(educator: any, project: any, funder: string) {
  const issueDate = excelSerialToDate(educator.id_issue_date);
  const birthDate = educator.birth_date ? excelSerialToDate(educator.birth_date) : '........';
  const startDate = educator.contract_starting_date ? dayjs(educator.contract_starting_date).format('YYYY/MM/DD') : '........';
  const endDate = educator.contract_end_date ? dayjs(educator.contract_end_date).format('YYYY/MM/DD') : '........';
  const today = dayjs().format('YYYY/MM/DD');
  const dayOfWeek = dayjs().locale('ar').format('dddd');

  const headerHtml = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1mm;">
        <div style="font-size: 13px; line-height: 1.3; font-weight: bold;">
            الجمهورية اليمنية<br/>
            الصندوق الاجتماعي للتنمية – فرع (صنعاء-الأمانة -المحويت – مأرب – الجوف).<br/>
            برنامج التحويلات النقدية المشروطة في التغذية<br/>
            رقم المشروع: ${arabicNumber(project.projectId)}
        </div>
        <img src="/sfd-logo.png" style="height: 20mm; width: auto;" alt="SFD Logo" />
    </div>
    <div style="border-bottom: 1.5px solid black; margin-bottom: 3mm; width: 100%;"></div>
  `;

  const footerHtml = (pageNum: number, showSignature = true) => `
    <div style="margin-top: auto; display: flex; flex-direction: column;">
        ${showSignature ? `
        <div style="text-align: right; margin-bottom: 4mm; font-size: 15px; font-weight: bold; padding-right: 10mm;">
            التوقيع
        </div>
        ` : '<div style="height: 8mm;"></div>'}
        <div style="border-top: 0.5px solid #333; padding-top: 1mm; display: flex; justify-content: space-between; align-items: flex-end; font-size: 14px; color: black; font-weight: bold;">
            <div style="background-color: #8b0000; color: white; width: 22px; height: 25px; display: flex; align-items: center; justify-content: center; border-radius: 2px; font-family: sans-serif; margin-bottom: 1mm; font-size: 14px; font-weight: bold;">${pageNum}</div>
            <div style="flex: 1; text-align: center; margin-bottom: 1mm;">عقد عمل مؤقت مثقفة مجتمعية – برنامج التحويلات النقدية المشروطة في التغذية – مديرية ${educator.mud_name || '........'}</div>
        </div>
    </div>
  `;

  const styles = `
    <style>
      .page {
        width: 210mm;
        height: 296mm;
        padding: 8mm;
        box-sizing: border-box;
        background: white;
        page-break-after: always;
        overflow: hidden;
      }
      .border-container {
        border: 1px solid black;
        padding: 6mm;
        min-height: 281mm;
        position: relative;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }
      .section {
        margin-bottom: 2mm;
        text-align: justify;
        line-height: 1.4;
        font-size: 14px;
      }
      .bold-underline {
        font-weight: bold;
        text-decoration: underline;
      }
      .title-style {
        text-align: center;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 2mm;
        text-decoration: underline;
      }
      .header-shape {
        background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
        border: 1px solid #ced4da;
        border-radius: 10px;
        padding: 3mm 10mm;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
        display: inline-block;
        font-size: 18px;
        font-weight: bold;
        color: #4a6fa5;
      }
      .blue-banner {
        background-color: #2F3C50;
        color: white;
        font-weight: bold;
        padding: 1.5mm 3mm;
        margin-bottom: 2mm;
        border-radius: 2px;
        font-size: 15px;
      }
      .manual-list {
        list-style-type: none;
        padding: 0;
        margin: 0;
      }
      .manual-list div {
        margin-bottom: 1mm;
        font-size: 14px;
      }
      .signature-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 5mm;
      }
      .signature-table td {
        border: 1px solid black;
        padding: 2mm;
        width: 50%;
        vertical-align: middle;
        font-size: 14px;
        text-align: center;
      }
      .signature-table .header-row {
        background-color: rgb(240, 240, 240);
        font-weight: bold;
      }
      .eval-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 4mm;
      }
      .eval-table th, .eval-table td {
        border: 1px solid black;
        padding: 2mm;
        text-align: center;
        font-size: 13px;
      }
      .eval-table th {
        background-color: #2F3C50;
        color: white;
        font-weight: bold;
      }
      .bank-data-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 4mm;
      }
      .bank-data-table td {
        border: 1px solid black;
        padding: 2mm;
        font-size: 14px;
        vertical-align: middle;
      }
      .bank-label-cell {
        background-color: #f2f2f2;
        font-weight: bold;
        text-align: right;
        width: 25%;
      }
      .checkbox-box {
        display: inline-block;
        width: 3.5mm;
        height: 3.5mm;
        border: 1px solid black;
        vertical-align: middle;
        margin-left: 1mm;
        margin-top: 2mm;
      }
    </style>
  `;

  return `
    <div class="contract-container" style="font-family: 'Sakkal Majalla'; direction: rtl; color: black;">
      ${styles}
      <!-- PAGE 1 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="title-style">
            عقد عمل مؤقت (نقد مقابل العمل في الخدمات الاجتماعية في التغذية)
          </div>
          <div style="text-align: left; font-size: 14px; font-weight: bold; text-decoration: underline; margin-bottom: 2mm;">
            ${arabicNumber(educator.ed_id || '........')}
          </div>
          <div class="section">أنه في يوم <span style="font-weight: bold;">${dayOfWeek}</span> الموافق <span style="font-weight: bold;">${arabicNumber(today)}</span> بمدينة صنعاء تم بين كلٍ من:</div>
          <div class="section">١) <span style="font-weight: bold;">الصندوق الاجتماعي للتنمية – فرع (صنعاء- الأمانة -المحويت - مأرب - الجوف)</span> ومقره شارع حدة- جولة الرويشان- خلف مول العرب (هاتف: 513821 فاكس 513803 ) ، الرقم المجاني للشكاوى والبلاغات (8009800). ويمثله الأستاذ/ <span class="bold-underline">محمد حسن غمضان</span> بصفته مدير الفرع ويسمى لأغراض هذا العقد بـ (الطرف الأول ) أو الصندوق.</div>
          <div class="section" style="margin-bottom: 2mm;">٢) الأخت/ <span class="bold-underline">${educator.applicant_name}</span> تحمل بطاقة شخصية رقم <span class="bold-underline">${arabicNumber(educator.id_no)}</span> صادرة من <span class="bold-underline">${educator.id_issue_location}</span> بتاريخ <span class="bold-underline">${arabicNumber(issueDate)}</span> ويسمى لأغراض هذا العقد بـ (الطرف الثاني).</div>
          
          <div class="bold-underline">البند الأول: موضوع العقد</div>
          <div class="section" style="margin-bottom: 3mm;">في إطار الصندوق الاجتماعي للتنمية – فرع (صنعاء- الأمانة -المحويت - مأرب - الجوف). -برنامج التحويلات النقدية المشروطة في التغذية وافق الطرف الثاني على العمل لدى الطرف الأول كمثقفة مجتمعية في القرى <span class="bold-underline">عزلة: ${educator.ozla_name || '........'}، قرية: ${educator.working_village}</span> في مديرية <span class="bold-underline">${educator.mud_name}</span> الممول من <span class="bold-underline">${funder}</span>.</div>
          
          <div class="bold-underline">البند الثاني: وصف العمل</div>
          <div class="section" style="margin-bottom: 3mm;">يتعهد الطرف الثاني بالقيام بمهامه ومسؤولياته وفق ما هو محدد ومسند له من الطرف الأول، بحسب وصف العمل المرفق بهذا العقد، والذي يعتبر جزء لا يتجزأ منه، وأن يكون أداء الطرف الثاني بأقصى إنتاجية وكفاءة ممكنة وبكل أمانة وإخلاص تجاه الطرف الأول وعمله ومصالحه، وكما هو مبين تفصيلاً في البند السابع (7) من هذا العقد.</div>
          
          <div class="bold-underline">البند الثالث: مدة العقد</div>
          <div class="section" style="margin-bottom: 3mm;">اتفق الطرفان على أن تكون مدة هذا العقد <span class="bold-underline">${arabicNumber(educator.contract_duration_months || '........')} أشهر</span> تبدأ من تاريخ <span class="bold-underline">${arabicNumber(startDate)}</span> وتنتهي في <span class="bold-underline">${arabicNumber(endDate)}</span>، إن لم يتم الإشعار كتابياً عن إنهاء العقد من قبل أي من الطرفين قبل انقضاء مدته، أو لم يُنص تحديداً على تعديل أو حذف أو إضافة أي بند من بنوده. ويحق لأحد الطرفين اخطار الطرف الاخر بشكل كتابي بإنهاء العقد.</div>
          
          <div class="bold-underline">البند الرابع: الأجر الشهري</div>
          <div class="section" style="margin-bottom: 2mm;">يتقاضى الطرف الثاني في نهاية كل شهر ميلادي ابتداءً من تاريخ مباشرة للعمل، وبالمقدار المحدد في العقد وفقاً لأيام العمل المنجزة والمهام المنجزة خلال الشهر والموافق عليها من قبل الطرف الأول، و وفق أحكام هذا العقد أجراً شهرياً صافياً ، مبلغ وقدره ( ${arabicNumber(100)} دولار ) ، مائة دولار موضحة على النحو التالي :<br/>1. ${arabicNumber(80)} دولار أجور الخدمات والمهام المنجزة خلال الشهر<br/>2. ${arabicNumber(20)} دولار أجور انتقال ومواصلات واتصالات وانترنت</div>
          
          <div class="bold-underline">البند الخامس: أيام وساعات العمل</div>
          <div class="section" style="margin-bottom: 4mm;">اتفق الطرفان بأن أيام العمل الرسمية هي خمس أيام عمل (من الأحد إلى الخميس) ، أو (من السبت إلى الأربعاء) يعقبهما يومي راحة مدفوعي الأجر، وأن ساعات العمل اليومية هي (${arabicNumber(6)}) ساعات ، ما يساوي(${arabicNumber(30)}) ساعة عمل أسبوعياً ، باستثناء شهر رمضان والتي ستحدد فيها ساعات العمل حسب تعليمات وتوجيهات الطرف الأول. ويمكن للمثقفة تنفيذ الأنشطة دون التقيد بالأيام الرسمية للعمل باعتبارها أنشطة مجتمعية.</div>
          
          <div class="bold-underline">يتم احتساب أيام العمل بواقع ${arabicNumber(20)} يوم عمل ميداني ويومان عمل من البيت لكتابة التقارير</div>
          <div class="manual-list">
            <div>▪ تنفيذ جلسة تثقيف صحي مرة كل شهر للأسرة المستهدفة من التحويلات النقدية المشروطة (يوم عمل)</div>
            <div>▪ تنفيذ جلسة توعية حول أهمية تعليم الفتاة مرة كل ثلاثة أشهر (يوم عمل)</div>
            <div>▪ مراقبة وتنظيم وترتيب المستفيدات اثناء عملية صرف المساعدات النقدية (يوم عمل)</div>
          </div>
          ${footerHtml(1)}
        </div>
      </div>

      <!-- PAGE 2 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="manual-list">
            <div>▪ تنفيذ زيارة منزلية شهريا لكل أسرة مستفيدة من التحويلات النقدية المشروطة لتقديم النصح والمشورة (${arabicNumber(8)} أيام)</div>
            <div>▪ تنفيذ زبارة منزلية شهرية لكل أسرة لمتابعة حالات سوء التغذية أو تقديم النصح والمشورة للأسرة (${arabicNumber('8 – 10')} أيام)</div>
            <div>▪ يومان عمل كتابة التقارير.</div>
          </div>
          
          <div class="bold-underline" style="margin-top: 4mm;">التقارير</div>
          <div class="manual-list">
            <div>▪ تقوم مثقفة المجتمع بإرسال تقرير شهري ، كل يوم ${arabicNumber(21)} من الشهر عبر إحدى التقنيات التالية ( الإيميل ، الوتساب ، تيليجرام ) إلى منسق المديرية ، وفي حال تعذر ذلك لأي سبب يتم إبلاغ المنسق ويقوم المنسق بإجراء الترتيب المناسب لجمع التقارير.</div>
            <div>▪ تقدم المثقفة تقرير ربعي يتضمن أهم الانجازات والتحديات الميدانية و التوصيات</div>
          </div>
          
          <div class="bold-underline" style="margin-top: 4mm;">البند السادس : الإجازات</div>
          <div class="section">يمنح الطرف الأول خلال فترة العقد الطرف الثاني الإجازات وأيام الراحة والعطل الرسمية التالية:</div>
          <div class="manual-list" style="margin-bottom: 2mm;">
            <div>1. يومي راحة في نهاية كل أسبوع ( الجمعة والسبت).(الخميس والجمعة)</div>
            <div>2. الإجازات والعطل الرسمية .</div>
            <div>3. إجازة وفاة لمدة ثلاثة أيام لأقارب من الدرجة الأولى.</div>
            <div>4. إجازة مرضية مدفوعة الأجر ولمرة واحدة خلال فترة العقد لا تزيد عن عن عشرة أيام عمل.</div>
            <div>5. يستحق الطرف الثاني إجازة مرضية مدفوعة الأجر إذا أصيب أثناء تأديته عمله ولمدة لا تتجاوز ${arabicNumber(20)} يوم عمل.</div>
            <div>6. إجازة وضع لمدة ثلاثين يوما فقط.</div>
          </div>
          
          <div class="bold-underline" style="margin-top: 2mm;">البند السابع: واجبات الطرف الثاني</div>
          <div class="section">يتعهد الطرف الثاني بالالتزام بالآتي:</div>
          <div class="manual-list">
            <div>1. أداء العمل بجدية وأمانة وانتظام بموجب اوصف العمل المرفق بهذا العقد ، وتخصيص كامل وقت العمل لأداء المهام والواجبات بكفاءة وفاعلية.</div>
            <div>2. احترام رؤسائه في العمل وتنفيذ التعليمات والتوجيهات الصادرة إليه منهم ، وكذا احترام زملائه ، وحسن التعامل مع موظفي وشركاء البرنامج.</div>
            <div>3. الحفاظ على خصوصية النساء والبيوت التي تقوم بزيارتها وعدم الإفشاء بأي بيانات أو معلومات تخص الأسرة للغير باستثناء ما هو لغرض انشطة البرنامج.</div>
            <div>4. التقيد بلوائح وأدلة وأنظمة العمل الذي أقر بالاطلاع عليها والعمل بموجبها.</div>
            <div>5. المواظبة على أوقات العمل واحترام المواعيد، والظهور بمظهر لائق أثناء تأدية الخدمة.</div>
            <div>6. حفظ وصيانة ممتلكات المشروع وكافة أدوات الخدمة الموضوعة في نطاق عمله من أجهزة ومعدات وسجلات ووثائق وغيرها وتسليمها للطرف الأول بعد انتهاء فترة العقد،إن كانت غير قابلة للإهلاك.</div>
            <div>7. الحفاظ على أسرار العمل أثناء وبعد انتهاء مدة هذا العقد.</div>
            <div>8. عدم الانخراط في أي نقاشات سياسية أثناء ساعات العمل سواء مع زملاء العمل أو شركاء البرنامج وعملائه.</div>
            <div>9. العمل بروح الفريق الواحد ، والتحلي بالأمانة والالتزام بن حسن السلوك والتمثيل الحسن واللائق للبرنامج في كافة تعاملاته وأنشطته ومشاركته.</div>
            <div>10. عدم طلب أو قبول أو استلام أية مبالغ نقدية بشكل عمولات ، أو مكأفات ، أو هدايا ،أو هبات أو تسهيلات أو خدمات أو منافع مباشرة أو غير مباشرة من أي شخص أو جهة ذات علاقة بأعمال وأنشطة المشروع أو الصندوق.</div>
          </div>
          ${footerHtml(2)}
        </div>
      </div>

      <!-- PAGE 3 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="manual-list">
            <div>11. إشعار ضابط ضابط المشروع/العمليات عبر أي وسيلة اتصال عن أي حدث أو تصرف قد تؤدي إلى الإضرار بالمشروع أو مصالح الطرف الأول وممتلكاته المادية أو المعنوية، ويُعتبر التستر أو عدم الإفصاح او تقديم بيانات غير دقيقة بشكل مُتعمد، مُخالفة صريحة أو إخلال بواجبات الطرف الثاني تجاه هذا العقد، ويعطي للطرف الأول الحق في اتخاذ ما يراه مُناسباً من إجراءات.</div>
            <div>12. يتحمل الطرف الثاني كامل المسؤولية عن دقة وصحة البيانات للأسر المستهدفة وأي تضليل فيها أو تقديم بيانات غير صحيحة يجعله عرضة للمساءلة القانونية، كما يعطي الطرف الأول الحق في إتخاذ ما يراه مُناسباً من إجراءات تجاه الطرف الثاني.</div>
            <div>13. اتباع أسلوب البساطة في الكلام والمظهر ومعاملة النساء بلطف واحترام ، وضبط النفس والتحلي بالصبر.</div>
            <div>14. عدم جمع اي تبرعات أو مبالغ مالية من النساء المستفيدات من المشروع أثناء أو بعد عملية صرف المساعدات النقدية تحت اي مسمى أو مبرر لصالح فرد أو طرف أو جهة .</div>
            <div>15. الامنتناع عن مزاولة أي عمل وظيفي لدى شخص أو جهة بأجر أو بدون أجر خلال فترة سريان هذا العقد.</div>
            <div>16. الاقرار بأنه تم الاطلاع بالتمام على متطلبات الصحة والسلامة المهنية وتخفيف الأثر البيئي ملحق(د) ومدونة تضارب المصالح ملحق (هـ) واعلان التعهد ملحق (و).</div>
          </div>

          <div class="bold-underline" style="margin-top: 4mm;">البند الثامن : تضارب المصالح :</div>
          <div class="section">
            يجب على الطرف الثاني الإفصاح عن أي تضارب في المصالح خلال فترة سريان عقده وذلك وفقا لدليل العمليات ، وتضارب المصالح وهو الوضع أو الموقف الذي تتأثر فيه موضوعية واستقلالية قرار الطرف الثاني أثناء تأديته لوظيفته، وذلك بمصلحة مادية أو معنوية تهمه هو شخصياً، أو أحد أقاربه، أو أصدقاؤه، أو بمعرفته للمعلومات المتعلقة باتخاذ القرار الذي يهم هذه الأطراف.
          </div>

          <div class="bold-underline" style="margin-top: 4mm;">البند التاسع : التزامات الطرف الأول</div>
          <div class="manual-list">
            <div>1. دفع أجر شهري مع المنافع المحتسبة بالمقدار المحدد في العقد وفقاً لأيام العمل المنجزة والمهام المنجزة خلال الشهر والموافق عليها من قبل الطرف الأول.</div>
            <div>2. توفير التدريب والتأهيل اللازم وفقا للشروط والسياسات والمزايا الواردة في دليل العمليات.</div>
          </div>

          <div class="bold-underline" style="margin-top: 4mm;">البند العاشر: انهاء أو فسخ العقد</div>
          <div class="section">اتفق الطرفان بموجب هذا العقد على حالات انتهاء أو فسخ هذا العقد وذلك على النحو التالي:</div>
          
          <div class="section">1. ينتهي هذا العقد بدون حاجة لإشعار من أي طرف للأخر في إحدى الحالات التالية:</div>
          <div class="manual-list" style="padding-right: 5mm; margin-bottom: 2mm;">
            <div>- اتفاق الطرفين كتابة على إنهاء العقد .</div>
            <div>- وفاة الطرف الثاني " لا قدر الله ".</div>
          </div>

          <div class="section">2. إنهاء هذا العقد من الطرف الأول قبل نهاية مدته بشرط إخطار الطرف الثاني برغبته تلك مع تحمل الأجر المقرر للطرف الثاني عن فترة الإنذار وذلك في الحالات التالية:</div>
          <div class="manual-list" style="padding-right: 5mm; margin-bottom: 2mm;">
            <div>▪ أخل بواجبات الوظيفة وسلوكها أو بشروط والتزامات العقد.</div>
            <div>▪ كانت نتيجة تقييم أدائه (غير مرضية).</div>
            <div>▪ كذب أو أخل بالثقة والأمانة أو قام باستعمال أو استغلال أموال أو ممتلكات البرنامج للمنفعة الشخصية أو لمنفعة الغير بطرق مباشرة أو غير مباشرة .</div>
          </div>
          ${footerHtml(3)}
        </div>
      </div>

      <!-- PAGE 4 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="manual-list" style="padding-right: 5mm;">
            <div>▪ أفشى للغير أسرار العمل أو ما يطلع عليه من معلومات وبيانات بحكم عمله.</div>
            <div>▪ عمل على تعكير جو العمل أو التسبب في أي إرباك عبر التحريض أو انخرط في أي نقاشات خارج إطار أهداف وأنشطة البرنامج أو التسبب في أي إرباك عبر التحريض أو إثارة البلبة أو أضرب عن العمل</div>
            <div>▪ أقدم على أي سلوك مشين ، قد يضر بالغير.</div>
            <div>▪ انتهاء المشروع الذي تم التعاقد من أجله مع الطرف الثاني.</div>
            <div>▪ ظهور ما يؤكد عدم سلامة أو صحة البيانات أو الوثائق التي تقدم بها الطرف الثاني وتم قبوله/ها على أساسها.</div>
            <div>▪ إذا تأخر الطرف الثاني عن مباشرة عمله/ها لأكثر من خمسة عشر يوماً من تاريخ سريان هذا العقد.</div>
            <div>▪ تعليق أو إلغاء المنحة المخصصة لأنشطة المشروع من قبل المانح أو انتهاء المشروع الذي تم التعاقد من خلالها مع الطرف الثاني.</div>
            <div>▪ عدم استئناف تمويل المشروع يلغى العقد مع الطرف الثاني دون أي مسئولية مترتبة على ذلك.</div>
            <div>▪ إذا تغيب الطرف الثاني عن العمل بدون إشعار مسبق مدة خمسة عشر يوما متصلة . أو تكرار غيابه غير المبرر بأكثر من شهر.</div>
            <div>▪ يحق للطرف الثاني إنهاء خدمات هذا العقد بدون إشعار كتابي إذا خالف الطرف الأول أيا من التزاماته الواردة في هذا العقد.</div>
            <div>▪ يحق للطرف الثاني إنهاء خدمات هذا العقد لأسباب خاصة، بشرط إشعار الطرف الأول كتابيا من رغبته في إنهاء العقد</div>
          </div>

          <div class="bold-underline" style="margin-top: 4mm;">البند الحادي عشر : أحكام ختامية</div>
          <div class="manual-list">
            <div>1. لا يُعتد قانوناً بأي اتفاقيات شفهية أو تمثيل غير منصوص عليه في هذا العقد، ويُلْغي هذا العقد أي عقد أو مكاتبة سابقاً بين الطرفين اعتباراً من تاريخ التوقيع عليه. كما تم التأكيد على أن تغييره في المستقبل يجب أن يكون خطياً.</div>
            <div>2. بمجرد توقيع الطرف الثاني على هذا العقد، فإنه يؤكد قراءته وإدراكه لبنوده ويوافق على شروطه نصاً وروحا.</div>
            <div>3. اي كشط او تغيير في مواد هذا العقد يلغيه</div>
          </div>

          <div class="bold-underline" style="margin-top: 4mm;">البند الثاني عشر : نُسخ العقد</div>
          <div class="section">حُرر هذا العقد من نسختين أصليتين بيد كل طرف نسخة أصلية للعمل بموجبها.</div>

          <div style="text-align: center; font-weight: bold; margin-top: 4mm; font-size: 16px;">الله ولي التوفيق ،،،،،</div>

          <table class="signature-table">
            <tr class="header-row">
              <td style="vertical-align: middle;">الطرف الثاني</td>
              <td style="vertical-align: middle;">الطرف الأول</td>
            </tr>
            <tr>
              <td style="vertical-align: middle;"><b>الاسم: ${educator.applicant_name}</b></td>
              <td style="vertical-align: middle;"><b>الاسم: محمد حسن غمضان</b></td>
            </tr>
            <tr>
              <td style="vertical-align: middle;">الصفة: مثقفة مجتمعية</td>
              <td style="vertical-align: middle;">الصفة: مدير الفرع</td>
            </tr>
            <tr>
              <td style="vertical-align: middle;">المديرية: ${educator.mud_name}</td>
              <td style="vertical-align: middle;">الصندوق الاجتماعي للتنمية فرع الأمانة - صنعاء - المحويت - مأرب - الجوف</td>
            </tr>
            <tr style="height: 20mm;">
              <td style="vertical-align: middle;">التوقيع:</td>
              <td style="vertical-align: middle;">التوقيع:</td>
            </tr>
          </table>

          ${footerHtml(4, false)}
        </div>
      </div>

      <!-- PAGE 5 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="title-style">
            الشروط المرجعية ونطاق الخدمات
          </div>
          
          <div class="manual-list" style="font-weight: bold; margin-bottom: 4mm;">
            <div>▪ المسمى الوظيفي : مثقفة مجتمعية</div>
            <div>▪ عدد الأسر المسؤولة عنها: ${arabicNumber(educator.ed_bnf_cnt || '........')}</div>
            <div>▪ النطاق الجغرافي للعمل : قرية ${educator.working_village} عزلة ${educator.ozla_name || '........'} مديرية ${educator.mud_name}</div>
            <div>▪ مدة العقد: ${arabicNumber(educator.contract_duration_months || '........')}</div>
            <div>▪ ساعات العمل : 6 ساعات عمل يوميا</div>
            <div>▪ المسؤول المباشر : ضابط العمليات</div>
          </div>

          <div style="font-weight: bold; margin-bottom: 2mm;">تعريف</div>
          <div class="section" style="margin-bottom: 4mm;">
            المثقفة المجتمعية تقوم بتوجيه مجموعة المعارف والمهارات التي اكتسبتها خلال التدريب لخدمة المجتمعات المستهدفة، وتعمل على تحسين الممارسات السلوكيات المعززة للصحة للأفراد والمجتمعات، وتلعب دورا حيويا في حث وتشجيع المجتمعات على طلب الخدمة الصحة، وتمارس المثقفة المجتمعية عملها وفقاً لكافة العمليات والإجراءات والأنشطة المحددة ضمن الدليل الاجرائي للمثقفة المجتمعية وتحت إشراف مباشر من المنسق الميداني، وتتمثل المهام الأساسية بالآتي:
          </div>

          <div class="bold-underline" style="margin-bottom: 2mm;">أولا: المهـــــام الأساسية</div>
          <div class="section" style="font-weight: bold; margin-bottom: 2mm;">1. مهام المثقفة المجتمعية تجاه المستفيدات من التحويلات النقدية</div>
          <div class="manual-list">
            <div>1. تذكير النساء المستهدفات بمواعيد تقديم الخدمات الصحية وجلسات التثقيف الصحي والتعليمي.</div>
            <div>2. تنفيذ جلسات التثقيف الصحي شهريا للنساء المستهدفات وحثهن وتحفيزهن على طلب الخدمات الصحية في المرافق الصحية الثابتة او الحملات الصحية الإيصالية التي تنفذها في وزارة الصحة العامة والسكان.</div>
            <div>3. تنفيذ جلسات التوعية والتثقيف بأهمية تعليم الفتاة "مرة كل ثلاثة أشهر" وحث الأسر على إرسال بناتهن إلى المدرسة واستمرار بقائهن في المدرسة إلى مراحل دراسية متقدمة.</div>
            <div>4. تسجيل حضور وغياب المستفيدات من التحويلات النقدية لجلسات التثقيف الصحي وأخذ بصمة المستفيدة ومطابقة الصورة وفقا لبطاقة إثبات الهوية وفق كشوف الجلسات.</div>
            <div>5. القيام بزيارات منزلية للأسر المستهدفة لتقديم النصح المباشر (وجها لوجه).</div>
            <div>6. تنظيم وترتيب المستفيدات في مواقع الصرف وكذا مراقبة إجراءات صرف المساعدات النقدية من قبل البنك الوسيط ومن خلال الحضور المبكر الى موقع الصرف (قبل موعد الصرف بربع ساعة -وحتى انتهاء الصرف ومغادرة فرق الصرف) وبما يضمن إيصال المبلغ النقدي الصحيح والمعتمد من الصندوق الاجتماعي للمستفيدة في المكان والزمان المحددين والابلاغ عن أي تجاوزات او اختلالات او اشكاليات اثناء الصرف وبعده سواء من جهة فرق الصرف أو أي جهة أخرى وتقوم المثقفة بتعبئة بيانات مراقبة الصرف وفق النموذج المحدد من قبل الصندوق</div>
            <div>7. التوثيق الفوتوغرافي لأنشطة الجلسات التثقيفية والزيارات المنزلية والصرف.</div>
          </div>
          ${footerHtml(5, true)}
        </div>
      </div>

      <!-- PAGE 6 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="section" style="font-weight: bold; margin-bottom: 2mm;">2. مهام المثقفة المجتمعية تجاه المجتمع المستهدف</div>
          <div class="manual-list">
            <div>1. مسح وفرز حالات سوء التغذية بين الأطفال والحوامل والمرضعات وتسجيلها وتحفيزها لطلب الخدمات من المرافق الصحية العلاجية.</div>
            <div>2. إجراء كافة الترتيبات اللوجستية لإحالة حالات سوء التغذية مثل (تزويد الأسرة بأسماء المرافق العلاجية الأقرب، التأكد من أن المرفق يوفر الخدمة، الترتيب مع فريق المشروع بشأن بدل المواصلات والإقامة للحالات التي تتطلب الرقود، تحديد موعد الإحالة .... الخ)</div>
            <div>3. متابعة حالات سوء التغذية ومتابعتها لحين استكمال العلاج من خلال الزيارة المنزلية أو التواصل مع المرافق العلاجية.</div>
            <div>4. التوثيق الفوتوغرافي لأنشطة مسح وفرز وإحالة حالات سوء التغذية والحالات قبل وبعد.</div>
          </div>

          <div class="bold-underline" style="margin-top: 4mm; margin-bottom: 2mm;">ثانياً: أيام العمل</div>
          <div class="section" style="margin-bottom: 2mm;">
            يتم احتساب أيام العمل بواقع ${arabicNumber(20)} يوم عمل ميداني ويومان عمل من البيت لكتابة التقارير
          </div>
          <div class="manual-list" style="margin-bottom: 4mm;">
            <div>▪ تنفيذ جلسة تثقيف صحي مرة كل شهر للنساء المستهدفات من التحويلات النقدية المشروطة (يوم عمل)</div>
            <div>▪ تنفيذ جلسة توعية حول أهمية تعليم الفتاة مرة كل ثلاثة أشهر (يوم عمل)</div>
            <div>▪ مراقبة وتنظيم وترتيب المستفيدات اثناء عملية صرف المساعدات النقدية (يوم عمل)</div>
            <div>▪ تنفيذ زيارة منزلية شهريا لكل أسرة مستفيدة من التحويلات النقدية المشروطة لتقديم النصح والمشورة (${arabicNumber(8)} أيام)</div>
            <div>▪ تنفيذ زبارة منزلية شهرية لكل أسرة لمتابعة حالات سوء التغذية أو تقديم النصح والمشورة للأسرة (${arabicNumber('8 – 10')} أيام)</div>
            <div>▪ يومان عمل كتابة التقارير.</div>
          </div>

          <div class="bold-underline" style="margin-bottom: 2mm;">ثالثا، كتابة التقارير</div>
          <div class="manual-list">
            <div>▪ تقوم مثقفة المجتمع بإرسال تقرير شهري بموجب نموذج المحدد كل يوم ${arabicNumber(21)} من الشهر عبر إحدى التقنيات التالية ( الإيميل ، الوتساب ، تيليجرام ) إلى المنسق الميداني، وفي حال تعذر ذلك لأي سبب يتم إبلاغ المنسق ويقوم المنسق بإجراء الترتيب المناسب لجمع التقارير.</div>
            <div>▪ تقدم المثقفة تقرير ربعي يتضمن أهم الانجازات والتحديات الميدانية والتوصيات</div>
          </div>
          ${footerHtml(6, true)}
        </div>
      </div>

      <!-- PAGE 7 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="title-style">
            رابعا: مراقبة وتقييم أداء المثقفة المجتمعية
          </div>
          <div class="section" style="margin-bottom: 4mm;">سوف تتم المراقبة على عدة مستويات وبشكل منتظم وسيتم تقييم الأداء وفقا للمعايير التالية:</div>
          
          <table class="eval-table">
            <thead>
              <tr>
                <th style="width: 40%;">قياس المؤشر</th>
                <th style="width: 15%;">الدرجة</th>
                <th style="width: 45%;">مؤشرات التقييم</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>تنفيذ الجلسة وفقا للجدول الزمني المخطط لها</td>
                <td>20</td>
                <td>تنفذ جلسات التثقيف الصحي والتعليمي بمواعيدها المحددة</td>
              </tr>
              <tr>
                <td>عدد الزيارات التي نفذت قياسا بعدد الأسرة المسؤولة عنها</td>
                <td>15</td>
                <td>تقوم بزيارات منزلية شهرية منتظمة للأسر المستهدفة لمتابعة حالات سوء التغذية وتقديم النصح والمشورة</td>
              </tr>
              <tr>
                <td>عدد الحالات التي حفزت من النساء الحوامل والمرضعات والأطفال</td>
                <td>20</td>
                <td>حفزت النساء وأمهات الأطفال اللذين يعانون من سوء التغذية للذهاب للمرافق العلاجية</td>
              </tr>
              <tr>
                <td>موعد تسليم التقرير وانتظامه</td>
                <td>10</td>
                <td>ترسل التقارير الشهرية بانتظام وبالموعد المحدد .</td>
              </tr>
              <tr>
                <td>جودة البيانات وسلامة الكشوفات واتساقها</td>
                <td>15</td>
                <td>الإحصائيات والبيانات التي تقوم برفعها عن حالات سوء التغذية أو جلسات التثقيف الصحي أو الزيارات المنزلية دقيقة وسليمة</td>
              </tr>
              <tr>
                <td>مدى الالتزام بالتوجيهات وتطبيقها</td>
                <td>10</td>
                <td>تتجاوب بإيجابية مع التعليمات الصادرة لها وتحرص على تنفيذها</td>
              </tr>
              <tr>
                <td>نظافة ووضوح الكشوفات والصور وكتابة الأنشطة عليها والاحتفاظ بصور قبل وبعد</td>
                <td>10</td>
                <td>التوثيق الجيد للأنشطة التي تنفذها</td>
              </tr>
            </tbody>
          </table>

          <div style="height: 10mm;"></div>

          <div style="display: flex; justify-content: flex-start;">
            <table class="eval-table" style="width: 50%; margin-top: 0;">
              <thead>
                <tr>
                  <th>الدرجة</th>
                  <th>التقدير</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>90-100</td><td>ممتاز</td></tr>
                <tr><td>80-89</td><td>جيد جدا</td></tr>
                <tr><td>70-79</td><td>جيد</td></tr>
                <tr><td>60-69</td><td>مقبول</td></tr>
                <tr><td>50-0</td><td>ضعيف</td></tr>
              </tbody>
            </table>
          </div>

          ${footerHtml(7, true)}
        </div>
      </div>

      <!-- PAGE 8 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div style="text-align: right; font-weight: bold; font-size: 16px; margin-bottom: 4mm;">
            الأخــوة / الصنـدوق الاجتماعي للتنمية <span style="margin-right: 40mm;">المحترمون</span>
          </div>
          <div class="section">نرجو شاكرين اعتماد البيانات المدونة أدناه عند قيام الصندوق بتحويل مستحقاتنا المذكـورة في العقــد الموقع</div>
          <div class="section">الخاص بمشروع : <span style="font-weight: bold;">${project.projectName}</span></div>
          <div class="section" style="margin-bottom: 4mm;">رقم المشروع: (${arabicNumber(project.projectId)})</div>

          <div class="bold-underline" style="margin-bottom: 2mm;">بيــانات المســتفيد فـي حالــة وجـود حســـاب مصـــرفي:</div>
          
          <table class="bank-data-table">
            <tr>
              <td class="bank-label-cell">اسم المستفيد رباعياً:</td>
              <td></td>
            </tr>
          </table>

          <table class="bank-data-table">
            <tr>
              <td class="bank-label-cell" style="width: 28%;">رقم الحساب المصرفي:</td>
              ${Array.from({ length: 12 }).map(() => '<td style="border: 1px solid black; width: 6%;"></td>').join('')}
            </tr>
          </table>

          <table class="bank-data-table">
            <tr>
              <td class="bank-label-cell" style="width: 15%;">اسم البنك:</td>
              <td></td>
              <td class="bank-label-cell" style="width: 15%;">الفرع:</td>
              <td></td>
            </tr>
          </table>

          <div class="bold-underline" style="margin-top: 4mm; margin-bottom: 2mm;">بيــانات المســتفيد فـي حالــة عــدم وجـود حســـاب مصـــرفي:</div>

          <table class="bank-data-table">
            <tr>
              <td class="bank-label-cell">اسم المستفيد رباعياً:</td>
              <td style="text-align: center;">${educator.applicant_name}</td>
            </tr>
          </table>

          <table class="bank-data-table" style="table-layout: fixed;">
            <tr>
              <td style="text-align: center;"><b>رقم البطاقة الشخصية:</b><br/>${arabicNumber(educator.id_no)}</td>
              <td style="border-top: 0; border-bottom: 0; width: 5mm;"></td>
              <td style="text-align: center;"><b>مكان الإصدار:</b><br/>${educator.id_issue_location || '........'}</td>
              <td style="text-align: center;"><b>تاريخ الإصدار:</b><br/>${arabicNumber(issueDate)}</td>
            </tr>
          </table>

          <table class="bank-data-table">
            <tr>
              <td class="bank-label-cell" style="width: 35%;">اسم البنك المراد التحويل إلية:</td>
              <td></td>
              <td class="bank-label-cell" style="width: 15%;">الفرع:</td>
              <td></td>
            </tr>
          </table>

          <div style="text-align: center; font-weight: bold; margin-top: 8mm; font-size: 16px;">وتقبلــــوا تحيـــاتنـــا ،،،،</div>

          <div style="margin-top: 10mm; space-y-4">
            <div style="text-align: center; font-weight: bold; margin-bottom: 4mm;">اسم المستفيد: ${educator.applicant_name}</div>
            <div style="text-align: center; font-weight: bold; margin-bottom: 4mm;">التـوقيـــع: .......................................</div>
            <div style="text-align: center; font-weight: bold; margin-bottom: 4mm;">الختـــــم : .......................................</div>
          </div>

          <div class="bold-underline" style="margin-top: 10mm;">ملاحظــة:</div>
          <div style="color: red; font-size: 14px; font-weight: bold; margin-top: 2mm;">
            * الصندوق لا يتحمل أي مسئولية ناتجة عن عدم صحة البيانات المقدمة أعلاه .
          </div>

          ${footerHtml(8, false)}
        </div>
      </div>

      <!-- PAGE 9: Annex D -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="title-style">
            الملحق(د)<br/>الشروط المرجعية لمعدي الدراسات الفنية للمشاريع بالسلامة والصحة المهنية والاثر البيئي والاجتماعي
          </div>
          
          <div class="manual-list" style="margin-bottom: 4mm;">
            <div>▪ الالتزام بتعليمات السلامة والصحة المهنية والاثر البيئي والاجتماعي أثناء تنفيذ المهام المكلف بها في مشاريع الصندوق.</div>
            <div>▪ يجب تحديد ودراسة المخاطر المحتملة للمشروع بالسلامة والاثر البيئي والاجتماعي ورفعها في الدراسة الفنية.</div>
            <div>▪ وضع المقترحات والحلول والبدائل المناسبة للحد ما أمكن من وقوع أي مخاطر مترتبة على تنفيذ المشروع بالسلامة والاثر البيئي والاجتماعي.</div>
            <div>▪ تحديد الأدوات المناسبة للمكونات وبما يتلاءم مع طبيعة العمل والمشروع وفق للمهام المطلوب تنفيذها بحسب مخرجات الدراسة الفنية وحجم العمالة المقترحة لتنفيذ أنشطة المشروع.</div>
            <div>▪ تحديد المخاطر المحتملة أثناء التشغيل ووضع المقترحات والحلول للحد من هذه المخاطر.</div>
          </div>

          <div class="bold-underline" style="margin-bottom: 2mm;">شروط مرجعية بالسلامة والصحة المهنية والاثر البيئي والاجتماعي للمهندسين</div>
          <div class="manual-list" style="margin-bottom: 4mm;">
            <div>▪ إعداد خطة بالسلامة والاثر البيئي والاجتماعي من بداية تنفيذ المشروع تسهم بجعل ظروف العمل آمنة لجميع العاملين ووضع الاحتياطات الكفيلة بمنع تعرض العاملين للأخطار الصحية وأخطار العمل.</div>
            <div>▪ تحليل العمليات الجارية في المشروع ووضع تعليمات تنفيذ سليمة وعمل التوعية المناسبة لكل مكون في المشروع قبل وأثناء التنفيذ.</div>
            <div>▪ العمل على نشر الثقافة الوقائية بالسلامة والاثر البيئي والاجتماعي.</div>
            <div>▪ تدريب العاملين على طرق العمل الفنية السليمة والإشراف على عملية التدريب وفق لإجراءات السلامة والاثر البيئي والاجتماعي.</div>
            <div>▪ الإشراف على اختيار معدات الوقاية الشخصية المناسبة لكل عملية من العمليات.وتوزيع معدات السلامة والصحة المهنية لكل العاملين مع مراعاة الخصوصية والتنوع في معدات السلامة المهنية بحسب نوعية العمل وإعطاء العمال بما يتلاءم مع طبيعة العمل.</div>
            <div>▪ الإشراف على تنفيذ برامج السلامة المهنية المقرة من قبل أدارة السلامة والاثر البيئي والاجتماعي فيما يخص العمل الميداني بالمشاريع.</div>
            <div>▪ التفتيش المنتظم على أماكن العمل واكتشاف مواطن الخطر ووضع الحلول والمقترحات والمعالجات وتصحيح الأوضاع الغير الامنة والتوثيق والابلاغ عن المخاطر بحسب النماذج المعتمدة.</div>
            <div>▪ دراسة أسباب الحوادث والحوادث الوشيكة ووضع الحلول والمعالجات التصحيحية الجذرية لضمان عدم تكرارها والتحقيق في حوادث العمل. وعمل الإحصائيات الدقيقة للحوادث.</div>
            <div>▪ الإبلاغ عن حالات الإصابات أثناء العمل خلال 48 ساعة الى ضابط المشروع.</div>
            <div>▪ متابعة مدى الالتزام من الفنيين العاملين في المشاريع بقضايا بالسلامة والاثر البيئي والاجتماعي.</div>
            <div>▪ تفعيل لائحة الجزاءات للمخالفين من العمال بالفنيين والمقاولين بقضايا السلامة والاثر البيئي والاجتماعي بحسب صلاحيته الممنوحة من الصندوق.</div>
          </div>

          <div class="bold-underline" style="margin-bottom: 2mm;">المهام المتعلقة بآلية فتح صناديق الشكاوى والتوعية الميدانية بآلية الشكاوى للاستشاريين المشرفين على مشاريع الصندوق .</div>
          <div class="section" style="margin-bottom: 4mm;">
            (الإشراف والتأكد من استكمال التوعية بآلية الشكاوى للجنة المجتمعية والمستفيدين المباشرين وغير المباشرين والتأكد من تعليق صندوق الشكاوى في مكان مناسب في إطار المشروع ومشاركة الاستشاري أو من ينوبه في فتح صندوق الشكاوى وحل الشكاوى التي في نطاق مهامه وتحرير محضر فتح الصندوق ومحضر حل الشكاوى الميدانية بالتعاون مع اللجان المجتمعية وفق النماذج المعدة لذلك وتسليمها ضمن محتويات التقرير النصف الشهري مع العلم أنه لن يتم قبول التقرير مالم يكون متضمن محضر فتح صندوق الشكاوى وحل الشكاوى الميدانية في المشروع حسب الآلية المعتمدة).
          </div>
          ${footerHtml(9, true)}
        </div>
      </div>

      <!-- PAGE 10 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="title-style">
            الملحق(هـ)<br/>مدونة تضارُب المصالح
          </div>
          
          <div class="section" style="margin-bottom: 4mm;">
            تتطلبُ سياسة الصندوق الاجتماعي للتنمية أن يتحلى موظفوه، وكذلك المتناقصون والموردون والمقاولون والمقاولون من الباطن والاستشاريون ومزودو الخدمات، بأعلى مستوى أخلاقي وألا يكون لديهم أي تضارُب مصالح خلال سير إجراءات التعاقدات والتوريد وتنفيذ العقود. وتناغما مع الأسس والمعايير المرعية المعمول بها في الصندوق الاجتماعي في جميع أنشطته، فقد صدرت مدونة تضارب المصالح في هذه الورقة
          </div>

          <div class="bold-underline" style="margin-bottom: 2mm;">البضائع والأشغال (الأعمال المدنية) والخدمات غير الاستشارية</div>
          <div class="manual-list" style="margin-bottom: 4mm;">
            <div>1- يُعتبَرُ المتقدم للمناقصة أو الممارسة (صاحب العرض) سواء كان مقاولاً أو مورداً أو متعهد خدمات غير استشارية في وضع تضارب المصالح في الحالات الآتية:</div>
            <div style="padding-right: 5mm;">1. عمليات توريد بضائع أو تنفيذ أشغال أو تقديم خدمات غير استشارية مرتبطة بصورة مباشرة أو غير مباشرة بخدمات استشارية تم تنفيذها من قبله في مرحلة الإعداد أو التنفيذ للمشروع ,أو أي خدمات نفذت من قبل أي جهة تابعة له أو تخضع بصورة مباشرة أو غير مباشرة لسلطته أو لسلطته مع آخرين بالمشاركة. هذا البند لا ينطبق على الشركات (استشاريين أو مقاولين أو موردين) التي تقوم مجتمعة بتنفيذ التزامات المقاول في اطار عقد تسليم مفتاح أو عقد التصميم والبناء.</div>
            <div style="padding-right: 5mm;">2. شاملا العاملين معه يكون لديه مصالح أو منافع أو أعمال وثيقة أو علاقات عائلية مع المختصين في الصندوق أو الجهة الكفيلة التنفيذية للمشروع أو المستفيد من جزء من تمويل الصندوق أو أي طرف آخر يمثل أو يقوم بأعمال نيابة عن الصندوق وهو:</div>
            <div style="padding-right: 10mm;">1. مشارك بصورة مباشرة أو غير مباشرة في الإعداد لوثائق التعاقد أو مواصفات العقد و/ أو التحليل والتقييم لإجراءات ذلك العقد.</div>
            <div style="padding-right: 10mm;">2. سيشارك في التنفيذ أو الإشراف على تنفيذ العقد، إلا اذا تم تسوية التضارب الناتج عن تلك العلاقة بأسلوب مُرضٍ للصندوق خلال سير إجراءات التعاقد أو التنفيذ للعقد.</div>
            <div style="padding-right: 10mm;">3. إذا لم يكن مستجيباً لأي من حالات تضارب المصالح الأخرى المحددة في وثائق التعاقد النمطية للصندوق ذات الصلة بعملية التعاقد المعنية.</div>
            <div>2- يجب على المتقدم للمناقصة أو الممارسة التصريح كتابة فيما اذا يوجد لديه علاقات عائلية أو أي مصالح أو منافع أو أعمال بصورة مباشرة أو غير مباشرة مع أي من العاملين في الصندوق طبقاً للنموذج المعد لذلك.</div>
          </div>

          <div class="bold-underline" style="margin-bottom: 2mm;">الخدمات الاستشارية</div>
          <div class="manual-list">
            <div>1. الصندوق الاجتماعي للتنمية يطلب من الاستشاريين ضرورة الالتزام بالآتي:</div>
            <div style="padding-right: 5mm;">1. تقديم مشورة مهنية وموضوعية ونزيهة.</div>
            <div style="padding-right: 5mm;">2. المراعاة التامة لمصالح الصندوق في كل الأوقات دون وضع أي اعتبار للحصول على أعمال أو مهام مستقبلية، و</div>
            <div style="padding-right: 5mm;">ج. تجنب أي تضارب مصالح في تقديم المشورة مع أي مهام أو عقود أخرى للاستشاري أو أي مصالح له أو لشركته الخاصة.</div>
          </div>
          ${footerHtml(10, true)}
        </div>
      </div>

      <!-- PAGE 11 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="section">4. ينبغي عدم التعاقد مع الاستشاريين لتنفيذ أية مهمة تتعارض مع أي من التزاماتهم السابقة أو الحالية لجهات أخرى، أو التي قد تجعلهم غير قادرين على تنفيذ المهمة بما يحقق مصالح الصندوق على أكمل وجه. ومع عدم تقييد عمومية العبارة السابقة, يجب عدم التعاقد مع الاستشاريين في الحالات الآتية:</div>
          
          <div class="section" style="padding-right: 5mm;">أ. الاستشاري الذي تعاقد الصندوق معه في عمليات توريد بضائع أو تنفيذ أشغال أو تقديم خدمات غير استشارية للمشروع (أو أية جهة تابعة للاستشاري أو تخضع بصورة مباشرة أو غير مباشرة لسلطته أو لسلطته مع آخرين بالمشاركة) ينبغي عدم تأهيله لتقديم خدمات استشارية ناتجة عن أو ذات صلة مباشرة بتلك البضائع أو الأشغال أو الخدمات غير الاستشارية. هذا البند (الشرط) لا ينطبق على الشركات (استشاريين أو مقاولين أو موردين) التي تقوم مجتمعة بتنفيذ التزامات المقاول في اطار عقد تسليم أو عقد تصميم وبناء.</div>
          
          <div class="section" style="padding-right: 5mm;">ب. الاستشاري الذي تعاقد الصندوق معه لتوفير خدمات استشارية لمرحلتي الإعداد والتنفيذ للمشروع ( أو أي جهة تابعة للاستشاري أو تخضع بصورة مباشرة أو غير مباشرة لسلطته أو لسلطته مع آخرين بالمشاركة) ينبغي عدم تأهيله بعد ذلك لعمليات توريد بضائع أو أشغال أو خدمات غير استشارية ناتجة عن أو مرتبطة مباشرة بتلك الخدمات الاستشارية. هذا البند(الشرط) لا ينطبق على الشركات (استشاريين أو مقاولين أو موردين) التي تقوم مجتمعة بتنفيذ التزامات المقاول في اطار عقد تسليم مفتاح أو عقد تصميم وبناء.</div>
          
          <div class="section">5. لا ينبغي التعاقد مع الاستشاري (شاملا العاملين معه و المتعاقدين من الباطن معه و أي جهات تابعه له أو تخضع بصورة مباشرة أو غير مباشرة لسلطته أو لسلطته مع آخرين بالمشاركة) لتنفيذ أي مهمة تودي بطبيعتها إلى تضارب مصالح مع مهمة أخرى للاستشاري .</div>
          
          <div class="section">6. الاستشاريون (شاملا الخبراء والعاملين الآخرين لديهم والاستشاريين الذين يتعاقدون معهم من الباطن) الذين تربطهم علاقات أعمال أو علاقات عائلية وثيقة مع العاملين الرئيسيين في الصندوق أو الجهة المنفذة للمشروع أو المستفيدة من جزء من تمويل الصندوق أو أي طرف يمثل أو يقوم بأعمال الصندوق وشارك بصورة مباشرة أو غير مباشرة في تنفيذ أي جزء مما يلي:</div>
          
          <div class="manual-list" style="padding-right: 5mm; margin-bottom: 2mm;">
            <div>● إعداد الشروط المرجعية للمهمة.</div>
            <div>● إجراءات تسيير العقد.</div>
            <div>● الإشراف على العقد،</div>
          </div>
          
          <div class="section">وفي هذه الحالات لا يجوز ترسية العقد عليهم ما لم تتم معالجة التضارب الناتج عن هذه العلاقة بأسلوب مقبول لدى الصندوق خلال سير إجراءات التعاقد وتنفيذ العقد.</div>
          
          <div class="section">3. يجب على الاستشاري أن يبلِّغ الصندوق كتابياً في حال أنَّ لديه علاقة عائلية أو أية مصالح مباشرة أو غير مباشرة مع أيٍّ من العاملين في الصندوق طبقاً للنموذج المعد لذلك.</div>
          
          ${footerHtml(11, true)}
        </div>
      </div>

      <!-- PAGE 12 -->
      <div class="page">
        <div class="border-container">
          ${headerHtml}
          <div class="title-style">بيان وإقرار</div>
          <div class="section" style="margin-top: 4mm;">
            هذه الورقة تحمل إقرار الاستشاري في العقد /مناقصة رقم (.........................................) بأنه تسلم من الصندوق الاجتماعي للتنمية نسخة من مُدونة تضارب المصالح ، وبخصوص علاقته بأحد العاملين في الصندوق فإنه يدلي بهذا البيان وكما يلي:
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2mm; margin-top: 4mm;">
              <div style="font-size: 14px; font-weight: bold;">1. لديه علاقة عائلية مع أحد العاملين</div>
              <div style="display: flex; gap: 4mm; align-items: center;">
                  <div style="display: flex; align-items: center; gap: 2mm;">
                      <span>نعم</span>
                      <table style="border-collapse: collapse; border: 1px solid black;"><tr><td style="width: 6mm; height: 6mm;"></td></tr></table>
                  </div>
                  <div style="display: flex; align-items: center; gap: 2mm;">
                      <span>لا</span>
                      <table style="border-collapse: collapse; border: 1px solid black;"><tr><td style="width: 6mm; height: 6mm;"></td></tr></table>
                  </div>
              </div>
          </div>

          <div class="section">في حال كانت الاجابة نعم يتم تعبئة مايلي:</div>
          <table class="eval-table" style="margin-top: 1mm; margin-bottom: 4mm;">
            <thead>
              <tr>
                <th style="width: 34%;">اسم العامل</th>
                <th style="width: 33%;">فرع الصندوق</th>
                <th style="width: 33%;">نوع العلاقة العائلية</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({length: 4}).map(() => `<tr><td style="height: 8mm;"></td><td></td><td></td></tr>`).join('')}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2mm; margin-top: 4mm;">
              <div style="font-size: 14px; font-weight: bold;">2. لديه مصالح مباشرة أوغير مباشرة مع أحد العاملين</div>
              <div style="display: flex; gap: 4mm; align-items: center;">
                  <div style="display: flex; align-items: center; gap: 2mm;">
                      <span>نعم</span>
                      <table style="border-collapse: collapse; border: 1px solid black;"><tr><td style="width: 6mm; height: 6mm;"></td></tr></table>
                  </div>
                  <div style="display: flex; align-items: center; gap: 2mm;">
                      <span>لا</span>
                      <table style="border-collapse: collapse; border: 1px solid black;"><tr><td style="width: 6mm; height: 6mm;"></td></tr></table>
                  </div>
              </div>
          </div>

          <div class="section">في حال كانت الإجابة نعم يتم تعبئة البيانات التالية:</div>
          <table class="eval-table" style="margin-top: 1mm; margin-bottom: 4mm;">
            <thead>
              <tr>
                <th style="width: 34%;">اسم العامل</th>
                <th style="width: 33%;">فرع الصندوق</th>
                <th style="width: 33%;">تفاصيل نوع المصلحة</th>
              </tr>
            </thead>
            <tbody>
              ${Array.from({length: 4}).map(() => `<tr><td style="height: 8mm;"></td><td></td><td></td></tr>`).join('')}
            </tbody>
          </table>

          <div class="section" style="margin-top: 4mm;">
            أنا الموقع أدناه ا ُدلي بهذا البيان والإقرار بأن جميع البيانات المذكرة أعلاه صحيحة، ويحق للصندوق إتخاذ الإجراءات التي يراها مناسبة تجاهي في حال عدم صحة البيانات المذكورة.
          </div>

          <div style="text-align: center; font-weight: bold; margin-top: 4mm; font-size: 16px;">والله الموفق</div>

          <div style="margin-top: 4mm; line-height: 1.8;">
            <div style="font-weight: bold; text-decoration: underline; margin-bottom: 2mm;">المثقفة المجتمعية:</div>
            <div style="text-align: right; font-weight: bold; margin-bottom: 4mm;">الاسم: ${educator.applicant_name}</div>
            <div style="text-align: right; font-weight: bold; margin-bottom: 4mm;">التـوقيـــع: .......................................</div>
            <div style="text-align: right; font-weight: bold; margin-bottom: 4mm;">الختـــــم : .......................................</div>
          </div>

          ${footerHtml(12, false)}
        </div>
      </div>

      <!-- PAGE 13 -->
      <div class="page">
        <div class="border-container">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1mm;">
              <div style="font-size: 13px; line-height: 1.3; font-weight: bold;">
                  الجمهورية اليمنية<br/>
                  الصندوق الاجتماعي للتنمية  <br/>
                  برنامج التحويلات النقدية المشروطة في التغذية
              </div>
              <div class="header-shape">استمارة إقرار وتعهد للمثقفة المجتمعية</div>
              <img src="/sfd-logo.png" style="height: 20mm; width: auto;" alt="SFD Logo" />
          </div>
          
          <div class="blue-banner">أولاً: بيانات الأساسية للمثقفة المجتمعية:</div>
          <div class="section" style="margin-bottom: 2mm;">
            اسم المثقفة خماسيا: <span style="font-weight: bold;">${educator.applicant_name}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; رقم التلفون: <span style="font-weight: bold;">${educator.phone_no || '........'}</span>
          </div>
          <div class="section" style="margin-bottom: 2mm;">
            المحافظة: <span style="font-weight: bold;">${educator.gov_name || '........'}</span> &nbsp;&nbsp; المديرية: <span style="font-weight: bold;">${educator.mud_name || '........'}</span> &nbsp;&nbsp; العزلة: <span style="font-weight: bold;">${educator.ozla_name || '........'}</span> &nbsp;&nbsp; القرية/المحلة: <span style="font-weight: bold;">${educator.loc_name || educator.working_village || '........'}</span>
          </div>
          <div class="section" style="margin-bottom: 2mm;">
            الحالة الاجتماعية: &nbsp;&nbsp; <span class="checkbox-box"></span> عازبة &nbsp;&nbsp; <span class="checkbox-box"></span> متزوجة &nbsp;&nbsp; <span class="checkbox-box"></span> مطلقة &nbsp;&nbsp; <span class="checkbox-box"></span> ارملة &nbsp;&nbsp; تاريخ الميلاد: <span style="font-weight: bold;">${birthDate}</span>
          </div>
          <div class="section" style="margin-bottom: 2mm;">
            هل المثقفة المجتمعية سجلت بياناتها ضمن المسح للاسر المستهدفة &nbsp;&nbsp; <span class="checkbox-box"></span> نعم &nbsp;&nbsp; <span class="checkbox-box"></span> لا
          </div>
          <div class="section" style="margin-bottom: 2mm;">
            في حال كانت الإجابة "لا" يتم تدوين السبب عدم مسحها ..............................................................................................................
          </div>

          <div class="blue-banner">ثانياً: البيانات التي سجلت بها المثقفة في المسح</div>
          <div class="section" style="margin-bottom: 2mm; font-style: italic;">
            في حال ان المثقفة سجلت بياناتها ضمن المسح (يتم تدوين البيانات التي سجلت بها المثقفة وفق لما ادلت به اثناء المسح)
          </div>
          <div class="section" style="margin-bottom: 2mm;">
            اسم المثقفة الأول: ................. اسم الأب: ........................ اسم الجد: .................. الاسم الرابع ................... اللقب ..................
          </div>
          <div class="section" style="margin-bottom: 2mm;">
            اسم العزلة/القرية التي مسحت فيها: ............/.............. &nbsp;&nbsp; العمر: ................ &nbsp;&nbsp; نوع الهوية: ............................. &nbsp;&nbsp; رقمها: ...........................
          </div>
          <div class="section" style="margin-bottom: 2mm;">
            حالة التأهل: &nbsp;&nbsp; <span class="checkbox-box"></span> حامل &nbsp;&nbsp; <span class="checkbox-box"></span> أم لطفل أقل من خمس سنوات &nbsp;&nbsp; <span class="checkbox-box"></span> ام لطفل ذو إعاقة ما بين 5-17 سنه
          </div>
          <div class="section" style="margin-bottom: 4mm;">
            اسم الزوج: الأول: ..................... اسم الأب.......................... اسم الجد: .................. الاسم الرابع ................... اللقب ..................
          </div>

          <table class="eval-table" style="margin-top: 0; margin-bottom: 0;">
            <tbody>
              <tr>
                <td style="text-align: right; font-weight: bold; border-bottom: 0;">
                  بيانات الأطفال التي سجلت بياناتهم في المسح &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; عدد الذكور (................) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; عدد الاناث (...............)
                </td>
              </tr>
            </tbody>
          </table>
          <table class="eval-table" style="margin-top: 0; margin-bottom: 4mm;">
            <thead>
              <tr>
                <th style="width: 35%;">اسم الطفل</th>
                <th style="width: 20%;">فئة العمرية</th>
                <th style="width: 15%;">عمر الطفل</th>
                <th style="width: 30%;">هل الطفل يعاني من أي إعاقة</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="height: 4mm;"></td><td></td><td></td><td></td></tr>
              <tr><td style="height: 4mm;"></td><td></td><td></td><td></td></tr>
            </tbody>
          </table>

          <div class="blue-banner">ثالثا: إقرار وتعهد المثقفة المجتمعية بصحة ودقة البيانات الواردة أعلاه</div>
          <div class="section" style="margin-bottom: 2mm;">
            أقر أنا الموقعة أدناه بأن البيانات الواردة في الاستمارة صحيحة وبأنني لم أكن ضمن النساء التي شملهن المسح المنفذ من الصندوق الاجتماعي للتنمية في مشروع التحويلات النقدية في التغذية كوني غير مؤهلة للاستفادة من المشروع، وفي حال كنت ضمن النساء اللاتي تم تسجيلهن فقد أعلنت عن ذلك وادليت بالبيانات التي سجلت بها في المسح في الاستمارة أعلاه وأنني قد اخترت بكامل الحرية الاستفادة من المشروع بالأجر مقابل عملي كمثقفة مجتمعية مقابل التنازل عن الاستفادة من المشروع كمستفيدة.
          </div>
          <div class="section" style="margin-bottom: 2mm;">
            وفي حال ثبت لاحقا أن حالة الازدواج مازالت قائمة وورد اسمي في كشف الاستحقاق كمثقفة مجتمعية وكشف الاستحقاق كمستفيدة من المساعدات النقدية اتحمل كافة المسؤولية المترتبة على ذلك، والتزم بإعادة أي مبالغ استلمتها إلى حساب المشروع ويحق للصندوق اتخاذ الإجراءات المناسبة المترتبة على عدم الإفصاح عن ذلك والتي قد تصل إلى إلغاء العقد والحرمان/الاستبعاد من الاستفادة من المشروع كمستفيدة والإدراج في القائمة السوداء
          </div>
          
          <div class="section" style="font-weight: bold; margin-bottom: 2mm;">
            اسم المثقفة: ${educator.applicant_name} &nbsp;&nbsp;&nbsp;&nbsp; التوقيع: ........................ &nbsp;&nbsp;&nbsp;&nbsp; التاريخ: .......................................................
          </div>

          <div class="blue-banner">المصادقة على البيانات من إدارة المشروع</div>
          <div class="section" style="margin-bottom: 2mm;">
            تم الرجوع الى قاعدة بيانات المسح والتأكد من صحة ودقة البيانات التي ادلت به المثقفة المجتمعية وتبين ان البيانات صحيحة وبأن رقم المستهدفة التي سجلت به بحسب استمارة المسح هو .....................
          </div>

          <div style="display: flex; justify-content: space-between; margin-top: 2mm;">
              <div style="text-align: center; width: 45%;">
                  <div style="font-weight: bold; margin-bottom: 2mm;">ضابط العمليات الفني</div>
                  <div style="font-weight: bold;">التوقيع</div>
              </div>
              <div style="text-align: center; width: 45%;">
                  <div style="font-weight: bold; margin-bottom: 2mm;">مدير المشروع</div>
                  <div style="font-weight: bold;">التوقيع</div>
              </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
