import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: '개인정보처리방침 | NEMONE PACE',
  description: 'NEMONE PACE 서비스 개인정보처리방침',
};

export default async function PrivacyPolicy({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang: rawLang } = await searchParams;
  const lang = rawLang || 'ko';
  const tr = (ko: string, en: string, zh: string, ja: string) =>
    lang === 'en' ? en : lang === 'zh' ? zh : lang === 'ja' ? ja : ko;

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-32 border-x border-zinc-200">
      <header className="fixed top-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 py-4 flex items-center gap-4">
        <Link href={`/?lang=${lang}`} className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">
          {tr('개인정보처리방침', 'Privacy Policy', '隐私政策', 'プライバシーポリシー')}
        </h1>
      </header>

      <main className="px-6 pt-24 pb-10">
        <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm prose prose-sm prose-zinc max-w-none text-zinc-600">
          <h2 className="text-xl font-black text-zinc-900 mb-6">
            {tr('개인정보처리방침', 'Privacy Policy', '隐私政策', 'プライバシーポリシー')}
          </h2>

          <p className="mb-6 leading-relaxed">
            <strong>{tr('네모네 주식회사', 'NEMONE Inc.', 'NEMONE股份有限公司', 'NEMONE株式会社')}</strong>
            {tr(
              "(이하 '회사')는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.",
              " ('the Company') establishes and discloses this privacy policy in accordance with Article 30 of the Personal Information Protection Act, to protect the personal information of data subjects and to handle related grievances promptly and smoothly.",
              '(以下简称"公司")根据《个人信息保护法》第30条制定并公开本隐私政策,以保护信息主体的个人信息,并能够迅速、顺畅地处理相关投诉。',
              '(以下「会社」)は「個人情報保護法」第30条に基づき、情報主体の個人情報を保護し、これに関する苦情を迅速かつ円滑に処理できるよう、次のとおり個人情報処理方針を策定・公開します。',
            )}
          </p>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">
            {tr('제1조 (개인정보의 처리 목적)', 'Article 1 (Purpose of Processing Personal Information)', '第1条(个人信息处理目的)', '第1条(個人情報の処理目的)')}
          </h3>
          <p className="mb-4 leading-relaxed">
            {tr(
              '회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.',
              'The Company processes personal information for the following purposes. The personal information processed will not be used for any purpose other than the following, and if the purpose of use changes, necessary measures such as obtaining separate consent will be implemented in accordance with Article 18 of the Personal Information Protection Act.',
              '公司为以下目的处理个人信息。所处理的个人信息不会用于以下目的之外的用途,如使用目的发生变更,将依据《个人信息保护法》第18条另行征得同意等,采取必要措施。',
              '会社は次の目的のために個人情報を処理します。処理している個人情報は次の目的以外の用途には利用されず、利用目的が変更される場合には「個人情報保護法」第18条に基づき別途同意を得るなど必要な措置を講じる予定です。',
            )}
          </p>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li>
              <strong>{tr('홈페이지 회원가입 및 관리', 'Website Membership Registration and Management', '网站会员注册及管理', 'ホームページ会員登録及び管理')}</strong>
              {tr(
                ': 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 각종 고지·통지 등을 목적으로 개인정보를 처리합니다.',
                ': Personal information is processed for purposes such as confirming intent to join, identifying/authenticating members for membership services, maintaining/managing membership status, preventing fraudulent use, and various notices.',
                ':为确认会员加入意愿、提供会员制服务时的本人身份识别与认证、维护及管理会员资格、防止服务不当使用、发送各类通知等目的处理个人信息。',
                ':会員登録意思の確認、会員制サービス提供に伴う本人識別・認証、会員資格の維持・管理、サービス不正利用防止、各種告知・通知等を目的として個人情報を処理します。',
              )}
            </li>
            <li>
              <strong>{tr('서비스 제공', 'Service Provision', '提供服务', 'サービス提供')}</strong>
              {tr(
                ': 위치 기반 여행 가이드 콘텐츠 제공, 다국어 서비스 최적화, 맞춤형 콘텐츠 추천 등을 목적으로 개인정보를 처리합니다.',
                ': Personal information is processed for purposes such as providing location-based travel guide content, optimizing multilingual services, and recommending personalized content.',
                ':为提供基于位置的旅行指南内容、优化多语言服务、推荐个性化内容等目的处理个人信息。',
                ':位置情報に基づく旅行ガイドコンテンツの提供、多言語サービスの最適化、カスタマイズされたコンテンツの推薦等を目的として個人情報を処理します。',
              )}
            </li>
            <li>
              <strong>{tr('마케팅 및 광고에의 활용', 'Use for Marketing and Advertising', '用于市场营销及广告', 'マーケティング及び広告への活用')}</strong>
              {tr(
                ': 신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공 및 참여기회 제공, 서비스의 유효성 확인, 접속빈도 파악 또는 회원의 서비스 이용에 대한 통계 등을 목적으로 개인정보를 처리합니다.',
                ': Personal information is processed for purposes such as developing new services and providing customized services, providing event and promotional information and participation opportunities, verifying service validity, and statistics on access frequency or service usage.',
                ':为开发新服务并提供定制化服务、提供活动及广告信息及参与机会、确认服务有效性、掌握访问频率或会员服务使用统计等目的处理个人信息。',
                ':新規サービスの開発及びカスタマイズサービスの提供、イベント及び広告性情報の提供及び参加機会の提供、サービスの有効性確認、接続頻度の把握または会員のサービス利用に関する統計等を目的として個人情報を処理します。',
              )}
            </li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">
            {tr('제2조 (처리하는 개인정보의 항목)', 'Article 2 (Items of Personal Information Processed)', '第2条(处理的个人信息项目)', '第2条(処理する個人情報の項目)')}
          </h3>
          <p className="mb-4 leading-relaxed">
            {tr('회사는 다음의 개인정보 항목을 처리하고 있습니다.', 'The Company processes the following items of personal information.', '公司处理以下个人信息项目。', '会社は次の個人情報項目を処理しています。')}
          </p>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li>
              <strong>{tr('필수항목', 'Required Items', '必填项目', '必須項目')}</strong>
              {tr(
                ': 사용자 ID(이메일 주소), 비밀번호, 닉네임, 접속 로그, 쿠키, 접속 IP 정보, 기기 식별자(ADID/IDFA 등)',
                ': User ID (email address), password, nickname, access logs, cookies, access IP information, device identifiers (ADID/IDFA, etc.)',
                ':用户ID(邮箱地址)、密码、昵称、访问日志、Cookie、访问IP信息、设备标识符(ADID/IDFA等)',
                ':ユーザーID(メールアドレス)、パスワード、ニックネーム、アクセスログ、クッキー、接続IP情報、機器識別子(ADID/IDFA等)',
              )}
            </li>
            <li>
              <strong>{tr('선택항목', 'Optional Items', '选填项目', '任意項目')}</strong>
              {tr(
                ': 연령대, 성별, 국적, 현재 위치 정보(위치 기반 가이드 제공 시)',
                ': Age group, gender, nationality, current location information (when providing location-based guides)',
                ':年龄段、性别、国籍、当前位置信息(提供基于位置的指南时)',
                ':年齢層、性別、国籍、現在位置情報(位置情報に基づくガイド提供時)',
              )}
            </li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">
            {tr('제3조 (개인정보의 처리 및 보유 기간)', 'Article 3 (Processing and Retention Period of Personal Information)', '第3条(个人信息的处理及保留期限)', '第3条(個人情報の処理及び保有期間)')}
          </h3>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li>
              {tr(
                '회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.',
                'The Company processes and retains personal information within the retention/use period stipulated by law or the period consented to by the data subject at the time of collection.',
                '公司在法令规定的个人信息保留、使用期限或从信息主体处收集个人信息时获得同意的保留、使用期限内处理并保留个人信息。',
                '会社は法令による個人情報の保有・利用期間、または情報主体から個人情報を収集する際に同意を得た個人情報の保有・利用期間内で個人情報を処理・保有します。',
              )}
            </li>
            <li>
              {tr('각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.', 'Each processing and retention period is as follows.', '各项个人信息处理及保留期限如下。', '各個人情報の処理及び保有期間は次のとおりです。')}
              <ul className="list-disc pl-5 mt-2">
                <li>
                  <strong>{tr('회원 가입 및 관리', 'Membership Registration and Management', '会员注册及管理', '会員登録及び管理')}</strong>
                  {tr(
                    ': 회원 탈퇴 시까지. 다만, 관련 법령에 의한 정보보유 사유가 발생할 경우 해당 기간까지 보유합니다.',
                    ': Until membership withdrawal. However, if there is a reason for retention under relevant laws, information will be retained for that period.',
                    ':至会员注销为止。但如因相关法令产生信息保留事由,则保留至该期限为止。',
                    ':会員退会時まで。ただし、関連法令による情報保有事由が発生した場合は当該期間まで保有します。',
                  )}
                </li>
              </ul>
            </li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">
            {tr('제4조 (개인정보의 제3자 제공)', 'Article 4 (Provision of Personal Information to Third Parties)', '第4条(向第三方提供个人信息)', '第4条(個人情報の第三者提供)')}
          </h3>
          <p className="mb-4 leading-relaxed">
            {tr(
              '회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.',
              'The Company processes personal information only within the scope specified in Article 1 (Purpose of Processing), and provides personal information to third parties only in cases falling under Articles 17 and 18 of the Personal Information Protection Act, such as the data subject\'s consent or special provisions of law.',
              '公司仅在第1条(个人信息处理目的)中明示的范围内处理信息主体的个人信息,仅在符合《个人信息保护法》第17条及第18条规定的情况下(如信息主体同意、法律特别规定等)向第三方提供个人信息。',
              '会社は情報主体の個人情報を第1条(個人情報の処理目的)で明示した範囲内でのみ処理し、情報主体の同意、法律の特別な規定等「個人情報保護法」第17条及び第18条に該当する場合にのみ個人情報を第三者に提供します。',
            )}
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-6 text-xs">
            <li><strong>{tr('제공받는 자', 'Recipient', '接收方', '提供を受ける者')}</strong>: Google (AdSense, Analytics {tr('등', 'etc.', '等', '等')})</li>
            <li><strong>{tr('제공목적', 'Purpose of Provision', '提供目的', '提供目的')}</strong>: {tr('광고 최적화, 앱 이용 통계 분석', 'Ad optimization, app usage statistics analysis', '广告优化、应用使用统计分析', '広告最適化、アプリ利用統計分析')}</li>
            <li><strong>{tr('제공항목', 'Items Provided', '提供项目', '提供項目')}</strong>: {tr('기기 식별자(ADID/IDFA), 접속 로그', 'Device identifiers (ADID/IDFA), access logs', '设备标识符(ADID/IDFA)、访问日志', '機器識別子(ADID/IDFA)、アクセスログ')}</li>
          </ul>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">
            {tr('제5조 (정보주체의 권리·의무 및 그 행사방법)', "Article 5 (Rights and Obligations of Data Subjects and How to Exercise Them)", '第5条(信息主体的权利、义务及行使方法)', '第5条(情報主体の権利・義務及びその行使方法)')}
          </h3>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li>
              {tr(
                '정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.',
                'Data subjects may exercise rights such as requesting access, correction, deletion, or suspension of processing of personal information at any time.',
                '信息主体可随时向公司行使个人信息查阅、更正、删除、停止处理等要求权利。',
                '情報主体は会社に対していつでも個人情報の閲覧・訂正・削除・処理停止要求等の権利を行使できます。',
              )}
            </li>
            <li>
              {tr(
                '권리 행사는 회사에 대해 서면, 전자우편 등을 통하여 하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.',
                'Rights may be exercised via written request, email, etc., and the Company will act on such requests without delay.',
                '权利行使可通过书面、电子邮件等方式向公司提出,公司将对此立即采取措施。',
                '権利行使は会社に対して書面、電子メール等を通じて行うことができ、会社はこれに対して遅滞なく措置します。',
              )}
            </li>
            <li>
              <strong>{tr('계정 삭제(탈퇴) 방법', 'How to Delete (Withdraw) Your Account', '账户删除(注销)方法', 'アカウント削除(退会)方法')}</strong>
              {tr(
                ": 사이트 내 '마이페이지 > 설정(톱니바퀴) > 회원 탈퇴하기' 기능을 이용하거나, 고객센터(contact@nemoneai.com)로 메일을 보내 요청할 수 있습니다.",
                ": Use the 'My Page > Settings (gear icon) > Delete Account' feature on the site, or send a request by email to Customer Support (contact@nemoneai.com).",
                ':可使用网站内"我的页面 > 设置(齿轮图标) > 注销会员"功能,或发送邮件至客服中心(contact@nemoneai.com)申请。',
                ':サイト内「マイページ > 設定(歯車アイコン) > 退会する」機能を利用するか、カスタマーセンター(contact@nemoneai.com)にメールを送って依頼できます。',
              )}
            </li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">
            {tr('제6조 (개인정보의 파기)', 'Article 6 (Destruction of Personal Information)', '第6条(个人信息的销毁)', '第6条(個人情報の破棄)')}
          </h3>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li>
              {tr(
                '회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.',
                'The Company destroys personal information without delay once it becomes unnecessary, such as when the retention period has elapsed or the processing purpose has been achieved.',
                '当个人信息保留期限届满、处理目的已实现等致使个人信息不再需要时,公司将立即销毁该个人信息。',
                '会社は個人情報の保有期間の経過、処理目的の達成等により個人情報が不要になった場合、遅滞なく当該個人情報を破棄します。',
              )}
            </li>
            <li>
              {tr(
                '전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 파기합니다.',
                'Information in electronic file form is destroyed using technical methods that prevent the record from being reproduced.',
                '电子文件形式的信息将采用无法恢复记录的技术方法进行销毁。',
                '電子的ファイル形式の情報は記録を再生できない技術的方法を使用して破棄します。',
              )}
            </li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">
            {tr('제7조 (개인정보의 안전성 확보 조치)', 'Article 7 (Measures to Ensure the Security of Personal Information)', '第7条(确保个人信息安全的措施)', '第7条(個人情報の安全性確保措置)')}
          </h3>
          <p className="mb-4 leading-relaxed text-xs">
            {tr('회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.', 'The Company takes the following measures to ensure the security of personal information.', '公司为确保个人信息的安全采取以下措施。', '会社は個人情報の安全性確保のため次のような措置を講じています。')}
          </p>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li>
              <strong>{tr('관리적 조치', 'Administrative Measures', '管理性措施', '管理的措置')}</strong>
              {tr(': 내부관리계획 수립 및 시행, 정기적 직원 교육 등', ': Establishment and implementation of internal management plans, regular employee training, etc.', ':制定并实施内部管理计划、定期员工培训等', ':内部管理計画の策定及び施行、定期的な職員教育等')}
            </li>
            <li>
              <strong>{tr('기술적 조치', 'Technical Measures', '技术性措施', '技術的措置')}</strong>
              {tr(
                ': 개인정보처리시스템 등의 접근권한 관리, 개인정보의 암호화(HTTPS, 비밀번호 단방향 암호화 등)',
                ': Access control for personal information processing systems, encryption of personal information (HTTPS, one-way password encryption, etc.)',
                ':管理个人信息处理系统等的访问权限、个人信息加密(HTTPS、密码单向加密等)',
                ':個人情報処理システム等のアクセス権限管理、個人情報の暗号化(HTTPS、パスワード一方向暗号化等)',
              )}
            </li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">
            {tr('제8조 (개인정보 보호책임자)', 'Article 8 (Personal Information Protection Officer)', '第8条(个人信息保护负责人)', '第8条(個人情報保護責任者)')}
          </h3>
          <p className="mb-4 leading-relaxed text-xs">
            {tr(
              '회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.',
              'The Company designates a Personal Information Protection Officer as below, who takes overall responsibility for personal information processing and handles complaints and remedies related to personal information processing.',
              '公司为全面负责个人信息处理相关工作,并为处理信息主体关于个人信息处理的投诉及损害救济,指定以下个人信息保护负责人。',
              '会社は個人情報処理に関する業務を総括して責任を負い、個人情報処理に関する情報主体の苦情処理及び被害救済等のため、以下のとおり個人情報保護責任者を指定しています。',
            )}
          </p>
          <ul className="list-none space-y-2 mb-6 text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-100">
            <li><strong>{tr('성명', 'Name', '姓名', '氏名')}</strong>: {tr('정환석 (CTO)', 'Hwanseok Jung (CTO)', '郑桓奭 (CTO)', 'チョン・ファンソク (CTO)')}</li>
            <li><strong>{tr('이메일', 'Email', '邮箱', 'メール')}</strong>: contact@nemoneai.com</li>
            <li><strong>{tr('전화번호', 'Phone', '电话号码', '電話番号')}</strong>: 02-6417-7318</li>
            <li><strong>{tr('주소', 'Address', '地址', '住所')}</strong>: {tr('제주시 한경면 낙천리 1235, 네모네 주식회사', '1235 Nakcheon-ri, Hangyeong-myeon, Jeju-si, Jeju, Korea, NEMONE Inc.', '济州市翰京面乐泉里1235号,NEMONE股份有限公司', '済州市翰京面楽泉里1235、NEMONE株式会社')}</li>
          </ul>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">
            {tr('제9조 (개인정보 처리방침 변경)', 'Article 9 (Changes to the Privacy Policy)', '第9条(隐私政策的变更)', '第9条(個人情報処理方針の変更)')}
          </h3>
          <p className="mb-8 leading-relaxed text-xs">
            {tr('이 개인정보처리방침은 2026년 3월 25일부터 적용됩니다.', 'This privacy policy is effective from March 25, 2026.', '本隐私政策自2026年3月25日起施行。', 'この個人情報処理方針は2026年3月25日から適用されます。')}
          </p>

          <div className="pt-6 border-t border-zinc-100 text-center">
            <p className="font-bold text-zinc-900">{tr('네모네 주식회사', 'NEMONE Inc.', 'NEMONE股份有限公司', 'NEMONE株式会社')}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
