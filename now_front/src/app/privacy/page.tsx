import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: '개인정보처리방침 | NOW HERE',
  description: '지금여기 서비스 개인정보처리방침',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-32 border-x border-zinc-200">
      <header className="fixed top-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">개인정보처리방침</h1>
      </header>

      <main className="px-6 pt-24 pb-10">
        <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm prose prose-sm prose-zinc max-w-none text-zinc-600">
          <h2 className="text-xl font-black text-zinc-900 mb-6">개인정보처리방침</h2>
          
          <p className="mb-6 leading-relaxed">
            <strong>네모네 주식회사</strong>(이하 '회사')는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
          </p>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">제1조 (개인정보의 처리 목적)</h3>
          <p className="mb-4 leading-relaxed">회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li><strong>홈페이지 회원가입 및 관리</strong>: 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 각종 고지·통지 등을 목적으로 개인정보를 처리합니다.</li>
            <li><strong>서비스 제공</strong>: 위치 기반 여행 가이드 콘텐츠 제공, 다국어 서비스 최적화, 맞춤형 콘텐츠 추천 등을 목적으로 개인정보를 처리합니다.</li>
            <li><strong>마케팅 및 광고에의 활용</strong>: 신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공 및 참여기회 제공, 서비스의 유효성 확인, 접속빈도 파악 또는 회원의 서비스 이용에 대한 통계 등을 목적으로 개인정보를 처리합니다.</li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">제2조 (처리하는 개인정보의 항목)</h3>
          <p className="mb-4 leading-relaxed">회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li><strong>필수항목</strong>: 사용자 ID(이메일 주소), 비밀번호, 닉네임, 접속 로그, 쿠키, 접속 IP 정보, 기기 식별자(ADID/IDFA 등)</li>
            <li><strong>선택항목</strong>: 연령대, 성별, 국적, 현재 위치 정보(위치 기반 가이드 제공 시)</li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">제3조 (개인정보의 처리 및 보유 기간)</h3>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li>회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</li>
            <li>각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.
              <ul className="list-disc pl-5 mt-2">
                <li><strong>회원 가입 및 관리</strong>: 회원 탈퇴 시까지. 다만, 관련 법령에 의한 정보보유 사유가 발생할 경우 해당 기간까지 보유합니다.</li>
              </ul>
            </li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">제4조 (개인정보의 제3자 제공)</h3>
          <p className="mb-4 leading-relaxed">회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</p>
          <ul className="list-disc pl-5 space-y-2 mb-6 text-xs">
            <li><strong>제공받는 자</strong>: Google (AdSense, Analytics 등)</li>
            <li><strong>제공목적</strong>: 광고 최적화, 앱 이용 통계 분석</li>
            <li><strong>제공항목</strong>: 기기 식별자(ADID/IDFA), 접속 로그</li>
          </ul>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">제5조 (정보주체의 권리·의무 및 그 행사방법)</h3>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li>정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.</li>
            <li>권리 행사는 회사에 대해 서면, 전자우편 등을 통하여 하실 수 있으며 회사는 이에 대해 지체 없이 조치하겠습니다.</li>
            <li><strong>계정 삭제(탈퇴) 방법</strong>: 사이트 내 '마이페이지 &gt; 설정(톱니바퀴) &gt; 회원 탈퇴하기' 기능을 이용하거나, 고객센터(contact@nemoneai.com)로 메일을 보내 요청할 수 있습니다.</li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">제6조 (개인정보의 파기)</h3>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li>회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.</li>
            <li>전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 파기합니다.</li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">제7조 (개인정보의 안전성 확보 조치)</h3>
          <p className="mb-4 leading-relaxed text-xs">회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
          <ol className="list-decimal pl-5 space-y-2 mb-6 text-xs">
            <li><strong>관리적 조치</strong>: 내부관리계획 수립 및 시행, 정기적 직원 교육 등</li>
            <li><strong>기술적 조치</strong>: 개인정보처리시스템 등의 접근권한 관리, 개인정보의 암호화(HTTPS, 비밀번호 단방향 암호화 등)</li>
          </ol>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">제8조 (개인정보 보호책임자)</h3>
          <p className="mb-4 leading-relaxed text-xs">회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
          <ul className="list-none space-y-2 mb-6 text-xs bg-zinc-50 p-4 rounded-xl border border-zinc-100">
            <li><strong>성명</strong>: 정환석 (CTO)</li>
            <li><strong>이메일</strong>: contact@nemoneai.com</li>
            <li><strong>전화번호</strong>: 02-6417-7318</li>
            <li><strong>주소</strong>: 제주시 한경면 낙천리 1235, 네모네 주식회사</li>
          </ul>

          <h3 className="text-sm font-bold text-zinc-900 mt-8 mb-3">제9조 (개인정보 처리방침 변경)</h3>
          <p className="mb-8 leading-relaxed text-xs">이 개인정보처리방침은 2026년 3월 25일부터 적용됩니다.</p>
          
          <div className="pt-6 border-t border-zinc-100 text-center">
            <p className="font-bold text-zinc-900">네모네 주식회사</p>
          </div>
        </div>
      </main>
    </div>
  );
}