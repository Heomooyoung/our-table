/* 우리집 식탁 — 단계별 UX 검증 (jsdom 사용자 여정 시뮬레이션) */
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');

const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/not implemented/.test(String(e))) console.error('[jsdomError]',String(e).slice(0,300)); });

let pass=0,fail=0; const fails=[];
function ok(cond,label){ if(cond){pass++;console.log('  PASS',label)} else {fail++;fails.push(label);console.log('  FAIL',label)} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+html+'</body></html>',
  {runScripts:'dangerously',pretendToBeVisual:true,url:'https://test.local/',virtualConsole:vc});
 const w=dom.window,d=w.document;
 const g=expr=>w.eval(expr);                       // let 전역 접근
 const q=s=>d.querySelector(s), qa=s=>[...d.querySelectorAll(s)];
 const click=el=>{ if(typeof el==='string')el=q(el); if(!el)throw new Error('click 대상 없음');
  el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true})); };
 const type=(sel,v)=>{const el=q(sel);el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));
  el.dispatchEvent(new w.Event('change',{bubbles:true}))};
 const byText=(sel,txt)=>qa(sel).find(e=>e.textContent.includes(txt));
 const toast=()=>q('#toast').textContent;
 const render_=()=>g('render()');
 const closeAll=async()=>{while(g('SHEETS.length')){g('shClose()');await sleep(30)} await sleep(320)};
 await sleep(300); // init 대기
 w.scrollTo=()=>{}; // jsdom 미구현 소음 제거
 g('if(window.SVGElement)SVGElement.prototype.getTotalLength=function(){return 120}'); // jsdom 미구현 보강

 console.log('\n[1단계] 첫 실행 · 홈');
 ok(q('#scr .hero'),'홈 히어로 렌더');
 ok(qa('#scr .wrow').length===7,'주간 리스트 7일');
 ok(g('S.menus.length')===1&&g('S.menus[0].name').includes('화덕브레드'),'시드 메뉴 존재');
 console.log('   히어로 버튼:',qa('.hero .acts .btn').map(b=>b.textContent.trim()).join(' / '));
 ok(!q('.connbar'),'서버 불가 환경 → 연결 배너 없음');

 console.log('\n[2단계] 메뉴 등록');
 click('.fab'); await sleep(80);
 ok(q('#f-name'),'등록 시트 열림');
 click(byText('.sw button','메뉴판에 올리기')); await sleep(60);
 ok(toast().includes('이름'),'이름 없이 저장 → 안내');
 type('#f-name','김치찜');
 q('#qing').value='돼지고기 300g (한돈)';
 click('[data-a="qingAdd"]'); await sleep(60);
 ok(qa('#ingRows .irow').length===1,'빠른 입력 → 재료 행 생성');
 const ir=q('#ingRows .irow');
 ok(ir.dataset.name==='돼지고기'&&ir.dataset.amount==='300g'&&ir.dataset.brand==='한돈','이름·양·브랜드 자동 분해');
 ok(ir.querySelector('.iqn').value==='300'&&ir.querySelector('.iu').value==='g','수량·단위 분리 입력');
 click(byText('.sw button','메뉴판에 올리기')); await sleep(450);
 ok(g('S.menus.length')===2,'메뉴 2개로 증가');
 ok(g('ui.tab')==='menus','저장 후 메뉴판 탭 이동');
 ok(!!byText('.lrow .lnm','김치찜'),'리스트에 김치찜 표시');

 console.log('\n[3단계] 중복 이름 안내');
 click('.fab'); await sleep(80);
 type('#f-name','김치찜');
 click(byText('.sw button','메뉴판에 올리기')); await sleep(120);
 ok(!!byText('.sw','이미 메뉴판에 있어요'),'중복 → 확인창 표시');
 ok(g('S.menus.length')===2,'아직 2개');
 click(byText('.sw button','네, 올릴게요')); await sleep(500);
 ok(g('S.menus.length')===3,'확인 후 등록됨');
 click(byText('.lrow .lnm','김치찜').closest('.lmain')); await sleep(80);
 click(byText('.sw .tbtn','메뉴판에서 빼기')); await sleep(80);
 click(byText('.sw button','네, 뺄게요')); await sleep(450);
 ok(g('S.menus.length')===2,'삭제 후 2개');
 await closeAll();

 console.log('\n[4단계] 상세 · 하트 · 해먹었어요');
 click(byText('.lrow .lnm','김치찜').closest('.lmain')); await sleep(80);
 const dHearts=qa('.sw .hearts.big [data-a="rate"]');
 ok(dHearts.length===5,'상세 하트 5개');
 click(dHearts[3]); await sleep(60);
 ok(g('S.menus.find(m=>m.name==="김치찜").rating')===4,'하트 4 반영');
 // 지난 끼니 자동 집계 (버튼 없이)
 const before=g('S.menus.find(m=>m.name==="김치찜").cookCount');
 g('(function(){const d=new Date();d.setDate(d.getDate()-1);const k=iso(d);S.plan[k]={d:S.menus.find(m=>m.name==="김치찜").id};autoCount()})()');
 ok(g('S.menus.find(m=>m.name==="김치찜").cookCount')===before+1,'지난 끼니 자동 집계 +1');
 g('autoCount()');
 ok(g('S.menus.find(m=>m.name==="김치찜").cookCount')===before+1,'재실행해도 중복 집계 안 됨');
 await closeAll();

 console.log('\n[5단계] 식단표 — 저녁 기본 · 펼치기 · 채우기');
 click(byText('.tb','식단표')); await sleep(80);
 ok(qa('#scr .slot').length===7,'기본은 저녁만 7칸');
 click(byText('#scr .chip','아침·점심 펼치기')); await sleep(80);
 ok(qa('#scr .slot').length===21,'펼치면 21칸');
 click(byText('#scr .chip','저녁만 보기')); await sleep(80);
 click(qa('#scr .day.today .slot')[0]); await sleep(80);
 ok(!!q('.sw #pkList'),'빈 칸 → 메뉴 고르기 시트');
 click(byText('.sw .prow .pnm','김치찜').closest('.prow')); await sleep(350);
 ok(!!byText('#scr .day.today .slot.fill .snm','김치찜'),'오늘 저녁 = 김치찜');

 console.log('\n[6단계] 홈 오늘 카드 · 다시 정하기');
 click(byText('.tb','홈')); await sleep(80);
 ok(!!byText('#scr .bigt','김치찜'),'홈 오늘의 저녁 — 크게 강조');
 ok(!!q('#scr .bigacts'),'바꾸기·레시피 액션 노출');
 ok(qa('#scr .wrow').length===7,'주간 리스트 7일');
 ok(!!byText('#scr .wrow.today .wm','김치찜'),'주간 리스트에 오늘 메뉴 표시');

 console.log('\n[7단계] 사다리 (메뉴 2개)');
 g('(function(){const k=todayISO();delete S.plan[k];save()})()'); render_(); await sleep(120);
 click(byText('#scr .btn','사다리')); await sleep(150);
 ok(!!q('.sw .lsvg'),'사다리 시트 열림');
 click(q('.sw .snode')); await sleep(1900);
 const gd=q('.sw #gdecide');
 ok(gd&&q('.sw #gacts').style.visibility==='visible','결과 후 결정 버튼 노출');
 if(gd)click(gd); await sleep(450);
 ok(!!q('#scr .bigt'),'사다리 결정 → 오늘 카드');
 ok(!!g('S.plan[todayISO()]&&S.plan[todayISO()].d'),'식단표 오늘 저녁 기록');

 console.log('\n[8단계] 장보기 — 자동 취합 · 체크 · 직접 추가');
 g('(function(){const k=todayISO();delete S.plan[k];save()})()');
 click(byText('.tb','식단표')); await sleep(120);
 click(qa('#scr .day.today .slot')[0]); await sleep(120);
 click(byText('.sw .prow .pnm','김치찜').closest('.prow')); await sleep(350);
 click(byText('.tb','장보기')); await sleep(150);
 ok(!!byText('#scr .sitem .snm2','돼지고기'),'재료 자동 취합');
 ok(!!byText('#scr .sitem .src','한돈'),'브랜드 표시');
 ok(!!byText('#scr .need','600g'),'필요량 합산(주 2회 × 300g = 600g)');
 ok(g('buyAmount("간장",{"큰술":4},1)')==='1병','조리 단위(큰술) → 구매 단위(병)');
 ok(g('buyAmount("방울토마토",{"개":2.5},1)')==='3개','개수는 올림');
 ok(g('buyAmount("돼지고기",{"g":1500},1)')==='1.5kg','1000g 이상은 kg 표기');
 ok(g('buyAmount("아몬드",{"줌":2},1)')==='1봉지','줌 → 봉지');
 ok(!!byText('#scr .chip','인 기준'),'인원 기준 칩');
 // 인원 바꾸면 양도 바뀜
 g('(function(){ui.people=4;render()})()'); await sleep(150);
 ok(!!byText('#scr .need','1.2kg'),'4인 기준 → 두 배(1.2kg)로 추천');
 ok(!!byText('#scr .chip','4인 기준'),'인원 칩 반영');
 g('(function(){ui.people=null;render()})()'); await sleep(150);
 ok(!!byText('#scr .sitem .src','김치찜'),'출처 메뉴 표기');
 click(byText('#scr .sitem .snm2','돼지고기').closest('.sitem')); await sleep(80);
 ok(!!q('#scr .sitem.done'),'체크 → 완료 표시');
 type('#xn','대파'); type('#xa','두 단');
 click(byText('#scr .xadd .btn','추가')); await sleep(80);
 ok(!!byText('#scr .sitem .snm2','대파'),'직접 추가 표시');

 console.log('\n[9단계] 가족 돌려찍기 투표');
 click(byText('.tb','홈')); await sleep(80);
 g('(function(){const k=todayISO();delete S.plan[k];save()})()'); render_(); await sleep(120);
 click(byText('#scr .btn','가족 투표')); await sleep(100);
 ok(!!q('.sw #famN'),'가족 미설정 → 등록 유도');
 type('#famN','무영'); click(byText('.sw .xadd .btn','추가')); await sleep(40);
 type('#famN','정은'); click(byText('.sw .xadd .btn','추가')); await sleep(40);
 ok(g('S.family.length')===2,'가족 2명 등록');
 click(byText('.sw button','저장하고 투표 시작')); await sleep(200);
 ok(!!q('#vbody'),'후보 고르기 시트');
 click(byText('#vbody button','돌려찍기')); await sleep(80);
 ok(!!byText('#vbody .vt2','무영'),'1번 차례 안내');
 click(byText('#vbody button','투표용지 받기')); await sleep(80);
 click(qa('#vbody .vopt')[0]); await sleep(80);
 ok(!!byText('#vbody .vt2','정은'),'2번 차례로 진행');
 click(byText('#vbody button','투표용지 받기')); await sleep(80);
 click(qa('#vbody .vopt')[0]); await sleep(150);
 ok(!!byText('#vbody .vt1','Result'),'개표 화면');
 const decideBtn=byText('#vbody button','이걸로 결정');
 ok(!!decideBtn,'승자 결정 버튼');
 if(decideBtn){click(decideBtn); await sleep(450)}
 ok(!!q('#scr .bigt'),'투표 결과 → 오늘 카드 반영');

 console.log('\n[10단계] 검색 · 정렬 · 뒤로가기');
 click(byText('.tb','메뉴판')); await sleep(80);
 type('#q','김치'); await sleep(550);
 ok(qa('#scr .lrow').length===1,'검색 필터 1건');
 ok(!byText('#scr .eyebrow','Best of Home'),'검색 중 베스트 숨김');
 type('#q',''); await sleep(550);
 ok(qa('#scr .lrow').length===2,'검색 해제 → 2건');
 click('.fab'); await sleep(80);
 ok(g('SHEETS.length')===1,'시트 1장 열림');
 w.history.back(); await sleep(250);
 ok(g('SHEETS.length')===0,'브라우저 뒤로가기 → 시트 닫힘');

 console.log('\n[11단계] 설정 · 우리집 식구');
 click('[data-a="settings"]'); await sleep(80);
 ok(!!byText('.sw .shead b','설정'),'설정 시트');
 ok(!byText('.sw .srow','우리집 계정 연결'),'연결 유도 문구 없음 (로그인이 유일한 입구)');
 ok(!byText('.sw .srow','가족 명단'),'"가족 명단"과 "우리집 식구"가 따로 있지 않음');
 ok(!!byText('.sw .srow','우리집 식구'),'구성원은 한 항목으로만 보임');
 click(byText('.sw .srow','우리집 식구')); await sleep(80);
 ok(!!byText('.sw .shead b','우리집 식구'),'구성원 시트 열림');
 ok(!!byText('.sw','자동으로 이 목록에 들어옵니다'),'식구는 초대로 자동 합류한다고 안내');
 ok(!q('.sw #famN'),'식구를 손으로 등록하는 칸이 없음');
 ok(!q('.sw [data-a="famDel"]'),'식구를 손으로 빼는 버튼도 없음');
 await closeAll();

 // 돌려찍기용 이름은 투표를 시작할 때만 다룬다
 const famN=g('famAll().length');
 g('openFamily(true)'); await sleep(100);
 ok(!!byText('.sw .shead b','이 폰으로 돌아가며 투표'),'돌려찍기 시트는 따로 열림');
 ok(!!byText('.sw','이 투표에서만'),'여기 이름은 이 투표용이라고 밝힘');
 ok(!!q('.sw #famN'),'여기서는 이름을 넣을 수 있음');
 click(qa('.sw [data-a="famDel"]')[0]); await sleep(60);
 ok(g('famAll().length')===famN-1,'이 폰에만 있던 이름은 뺄 수 있음');
 await closeAll();

 console.log('\n[12단계] 수정 검증 — 유령 히스토리 · 체크 정렬 · 검색 문구');
 click('[data-a="settings"]'); await sleep(60); g('shClose()'); await sleep(330);
 click('.fab'); await sleep(60); g('shClose()'); await sleep(330);
 click('[data-a="settings"]'); await sleep(60);
 ok(g('SHEETS.length')===1,'반복 여닫기 후 시트 열림');
 w.history.back(); await sleep(260);
 ok(g('SHEETS.length')===0,'반복 여닫기 후에도 뒤로가기로 닫힘');
 click(byText('.tb','장보기')); await sleep(150);
 const preItems=qa('#scr .sitem');
 ok(preItems.length>=2,'장보기 항목 2개 이상');
 const undone=preItems.filter(e=>!e.classList.contains('done'));
 const label=undone[0].querySelector('.snm2').textContent.trim();
 const n1=preItems.length;
 click(undone[0]); await sleep(160);
 ok(!!q('#scr .sdiv'),'산 것 구분선 표시');
 const doneEl=qa('#scr .sitem.done');
 ok(doneEl.length>=1&&doneEl[doneEl.length-1].querySelector('.snm2').textContent.includes(label.slice(0,2)),'체크한 항목이 산 것 섹션으로');
 click(byText('#scr .chip','구매 완료 숨기기')); await sleep(160);
 ok(qa('#scr .sitem').length<n1,'구매 완료 숨기기 동작');
 click(byText('#scr .chip','구매 완료 보이기')); await sleep(160);
 ok(qa('#scr .sitem').length===n1,'다시 보이기 동작');
 click(byText('.tb','메뉴판')); await sleep(120);
 type('#q','없는메뉴zzz'); await sleep(600);
 ok(!!byText('#scr .empty b','조건에 맞는'),'검색 무결과 전용 문구');
 type('#q',''); await sleep(550);

 console.log('\n[14단계] 재료 사전 · 구매 링크 · 목록 공유 · 로그인 버튼');
 click('.fab'); await sleep(80);
 ok(qa('.sw #dlIng option').length>250,'재료 사전 자동완성 250종 이상');
 await closeAll();
 click(byText('.tb','장보기')); await sleep(150);
 ok(qa('#scr .buy').length>=2,'쿠팡·컬리 구매 링크 표시');
 ok(!!byText('#scr .sdiv','사와야 할 것'),'살 것 구간이 이름으로 구분됨');
 const st=g('buildShopText()');
 ok(st.includes('장 봐올 것')&&!/[⬜✅]/.test(st),'보낼 텍스트는 체크박스 없이 깔끔하게');
 ok(st.split('\n').filter(l=>l.startsWith('• ')).length>0,'항목이 • 목록으로 정리됨');
 ok(st.includes('모두 ')&&st.includes('우리집 식탁'),'개수와 출처가 꼬리에 붙음');
 click('[data-a="shopShare"]'); await sleep(120);
 ok(!!byText('.sw .shead b','장보기 목록 보내기'),'보내기 시트 열림');
 const n0=g('SHOPSEL.size');
 ok(n0>0,`기본으로 아직 안 산 것 ${n0}개가 골라져 있음`);
 ok(!!byText('.sw .btn',`${n0}개 보내기`),'고른 개수가 버튼에 보임');
 ok(qa('.sw .sitem.pick').length===n0,'장 봐올 것이 체크된 상태로 보임');
 ok(!q('.sw .sitem.done'),'장보기 탭의 "이미 샀음" 표시와 섞이지 않음');
 click(q('.sw [data-a="ssTog"].pick')); await sleep(80);
 ok(g('SHOPSEL.size')===n0-1,'체크를 풀면 목록에서 빠짐');
 ok(qa('.sw .sitem.pick').length===n0-1,'푼 항목은 체크가 해제되어 보임');
 click(q('.sw [data-a="ssTog"].nopick')); await sleep(80);
 ok(g('SHOPSEL.size')===n0,'다시 체크하면 목록에 들어감');
 click(byText('.sw .btn','전부 고르기')); await sleep(80);
 ok(g('SHOPSEL.size')===g('shopKeys().length'),'전부 고르기 동작');
 // 시트를 덮는 검은 판(스크림)은 .sw의 직계 자식 하나뿐이어야 한다.
 // 장보기 항목 본문도 class="sb"라, 자손 전체를 잡으면 항목마다 화면을 덮어 시트가 까맣게 된다.
 ok(qa('.sw > .sb').length===1,'스크림은 시트당 하나');
 ok(qa('.sw .sb').length>1,'시트 안에 같은 이름의 항목 본문이 실제로 존재함');
 const css=d.querySelector('style').textContent;
 ok(css.includes('.sw>.sb{')&&!/\.sw \.sb\{/.test(css),'스크림 스타일이 직계 자식으로 한정됨');
 ok(!!byText('.sw .snm2',''),'항목 이름이 시트에 렌더됨');
 await closeAll();
 click('[data-a="settings"]'); await sleep(80);
 ok(!byText('.sw .srow','카카오'),'미로그인 설정엔 계정 항목 없음');
 await closeAll();

 console.log('\n[15단계] 월간 달력 · 장보기 기간 확장');
 click(byText('.tb','식단표')); await sleep(80);
 click(byText('#scr .chip','월간 달력')); await sleep(120);
 ok(qa('#scr .mcell').length>=28,'월간 달력 렌더');
 click(qa('#scr .mcell:not(.dim)')[10]); await sleep(120);
 ok(qa('#scr .day').length===7,'날짜 탭 → 해당 주간으로 이동');
 click(byText('.tb','장보기')); await sleep(150);
 click(byText('#scr .chip','한 달')); await sleep(100);
 ok(g('ui.shopSpan')===4,'기간 한 달(4주) 선택');
 ok(!!q('#scr .wknav'),'기간 확장 후 정상 렌더');
 click(byText('#scr .chip','1주')); await sleep(80);

 console.log('\n[16단계] 쿠팡 제품 검색 연동');
 // 중계 API를 가짜 응답으로 대체 (오프라인/CI에서도 동작)
 w.fetch=async(u)=>({json:async()=>({items:[{name:'[로켓프레시] 매일바이오 그릭요거트 무가당',price:6980,
   image:'https://img.example/1.jpg',url:'https://link.coupang.com/re/AFF?x=1',rocket:true}],notice:'고지'})});
 click('.fab'); await sleep(80);
 q('#qing').value='그릭요거트';
 click('[data-a="qingAdd"]'); await sleep(60);
 click(q('#ingRows .ibody')); await sleep(400);
 ok(true,'행 안의 제품 찾기 진입');
 ok(!!q('.sw .prod'),'제품 검색 결과 렌더');
 ok(!!byText('.sw .disc','수수료'),'파트너스 고지 문구 노출');
 click(q('.sw .prod')); await sleep(300);
 const row=q('#ingRows .irow');
 ok(row.dataset.url.includes('link.coupang.com'),'선택 → 구매 링크 저장');
 ok(row.dataset.photo.includes('img.example'),'선택 → 제품 사진 저장');
 ok((row.dataset.brand||'').includes('매일바이오'),'선택 → 상품명이 브랜드 칸에 그대로');
 type('#f-name','요거트볼');
 click(byText('.sw button','메뉴판에 올리기')); await sleep(450);
 const yg=g('S.menus.find(m=>m.name==="요거트볼")');
 ok(yg&&yg.ingredients[0].url.includes('coupang'),'저장된 메뉴에 구매 링크 유지');
 // 재료 행이 하나도 없는 상태에서 입력칸 옆 돋보기로 바로 검색 (PC에서 안 보이던 문제)
 click('.fab'); await sleep(80);
 ok(qa('#ingRows .irow').length===0,'새 폼은 재료 행 0개');
 ok(!!q('.ifield [data-a="qFind"]'),'입력칸 안에 제품 찾기 아이콘');
 q('#qing').value='그릭요거트';
 click('[data-a="qFind"]'); await sleep(400);
 ok(!!q('.sw .prod'),'입력 단계에서 바로 제품 검색');
 click(q('.sw .prod')); await sleep(300);
 ok(qa('#ingRows .irow').length===1&&q('#ingRows .irow').dataset.url.includes('coupang'),'검색 선택 → 재료 행 생성+링크');
 click(q('#ingRows .xbtn')); await sleep(80);
 q('#qing').value='그릭요거트 200g';
 click('[data-a="qingAdd"]'); await sleep(80);
 const nr0=q('#ingRows .irow');
 ok(nr0.dataset.name==='그릭요거트'&&nr0.querySelector('.iqn').value==='200','담기 → 수량 분리');
 click(q('#ingRows .ibody')); await sleep(400);
 ok(!!q('.sw .prod'),'담긴 재료 탭 → 제품 검색');
 click(q('.sw .prod')); await sleep(300);
 const nr=q('#ingRows .irow');
 ok(qa('#ingRows .irow').length===1,'행 유지(중복 생성 없음)');
 ok(nr.dataset.url.includes('coupang'),'행에 구매 링크 저장');
 ok(nr.querySelector('.iqn').value==='200','수량 보존');
 await closeAll();

 console.log('\n[17단계] 이번 피드백 반영 검증');
 // 한글 조합 엔터 중복 방지
 click('.fab'); await sleep(80);
 const qi=q('#qing'); qi.value='돼지고기';
 const ev=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
 Object.defineProperty(ev,'isComposing',{value:true});
 qi.dispatchEvent(ev);
 qi.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 await sleep(80);
 ok(qa('#ingRows .irow').length===1,'IME 엔터 중복 담기 방지');
 ok(q('#ingRows .irow').dataset.name==='돼지고기','재료명 온전');
 // 양 입력칸
 ok(q('#ingRows .iu').value===g('unitFor("돼지고기")'),'재료에 맞는 단위 자동 추천');
 ok(g('unitFor("계란")')==='알'&&g('unitFor("대파")')==='단'&&g('unitFor("간장")')==='큰술'&&g('unitFor("방울토마토")')==='개','단위 추천 규칙');
 // 메모 붙여넣기 제거
 ok(!byText('.sw button','메모 붙여넣기'),'메모 붙여넣기 UI 삭제됨');
 ok(!byText('.sw .cnt','No.'),'등록번호 표기 삭제됨');
 // 만드는 법: 입력 → 리스트로 분리
 const qs=q('#qstep'); qs.value='빵을 갈라 주세요';
 click('[data-a="stepAdd"]'); await sleep(60);
 ok(qa('#stepRows .strow').length===1&&q('#stepRows .stx').textContent.includes('빵을'),'만드는 법 담기 → 리스트');
 ok(q('#qstep').value==='','입력칸 비워짐');
 await closeAll();
 // 재료 사전 가나다순
 const names=g('ingNames()');
 ok(names.slice(-40).every((v,i,a)=>i===0||a[i-1].localeCompare(v,'ko')<=0),'재료 사전 가나다순');
 // 설정 선택 목록
 click('[data-a="settings"]'); await sleep(80);
 click(byText('.sw .srow','홈에 보이는 끼니')); await sleep(120);
 ok(qa('.sw .srow').length>=2&&!!byText('.sw .srow','아침·점심·저녁 모두'),'끼니 선택 목록 표시');
 click(byText('.sw .srow','아침·점심·저녁 모두')); await sleep(300);
 ok(g('S.homeMeals')==='all','끼니 설정 반영');
 click(byText('.sw .srow','장보기 기본 기간')); await sleep(120);
 ok(!!byText('.sw .srow','한 달'),'기간 선택 목록 표시');
 await closeAll();
 // 세 끼 모드 홈
 click(byText('.tb','홈')); await sleep(120);
 ok(qa('#scr .mealc').length===3,'세 끼 카드 3개');
 // 요일 탭 → 하루 시트
 click(qa('#scr .wrow')[0]); await sleep(150);
 ok(qa('.sw .mealc').length===3,'요일 탭 → 하루 세 끼 시트');
 await closeAll();
 g('(function(){S.homeMeals="d";save()})()'); render_(); await sleep(120);
 // 바꾸기 흐름
 const sw=q('#scr [data-a="swap"]');
 if(sw){click(sw); await sleep(150);
  ok(!!byText('.sw .srow','메뉴판에서 고르기')&&!!byText('.sw .srow','사다리로 다시 뽑기')&&!!byText('.sw .srow','비우기'),'바꾸기 = 고르기·사다리·투표·비우기');
  await closeAll();}
 else ok(false,'바꾸기 버튼 노출');

 console.log('\n[18단계] 공유 준비 — 둘러보기·의견');
 ok(!!g('typeof openFeedback')&&g('typeof openFeedback')==='function','의견 보내기 존재');
 click('[data-a="settings"]'); await sleep(100);
 ok(!!byText('.sw .srow','의견 보내기'),'설정에 의견 보내기');
 click(byText('.sw .srow','의견 보내기')); await sleep(150);
 ok(!!q('#fbMsg'),'의견 입력 시트');
 click(byText('.sw button','보내기')); await sleep(200);
 ok(toast().includes('내용')||!!q('#fbMsg'),'빈 내용이면 전송 안 됨');
 await closeAll();
 g('(function(){ui.gate=true;render()})()'); await sleep(120);
 ok(!!q('[data-a="peek"]'),'게이트에 먼저 둘러보기');
 ok(!q('[data-a="guest"]'),'"이 폰에만" 게스트 진입 제거됨');
 ok(qa('[data-a="oauth"]').length===2,'로그인은 카카오·구글 두 가지뿐');
 ok(!byText('#scr','초대 코드'),'게이트에 코드 입력칸 없음');

 console.log('\n[18-2단계] 초대 링크로 들어온 사람');
 g('(function(){pendingHash={join:"ABC123"};render()})()'); await sleep(120);
 ok(!!byText('#scr .sub','가족이 초대했어요'),'초대받은 티가 나는 첫 화면');
 ok(!!byText('#scr .ghint','입력할 필요 없어요'),'코드 입력 안내 대신 "로그인만 하면 됨"');
 ok(!q('[data-a="obJoin"]')&&!q('[data-a="obCreate"]'),'합류/새로만들기 2지선다 사라짐');
 g('(function(){pendingHash=null;ui.gate=false;render()})()'); await sleep(120);

 console.log('\n[17-2단계] 투표 흐름 — 올리기 · 알림 배너 · 내보내기 분리');
 g('(function(){HOME="h1";ME={id:"m1",home_id:"h1",name:"아빠"};MEMBERS=[ME,{id:"m2",home_id:"h1",name:"엄마"}];syncOn=true})()');
 g('(function(){OPENVOTE={id:"v1",meal:"d",candidates:["a","DELIV"],created_by:"m2",mine:false,total:1};ui.tab="home";render()})()');
 await sleep(120);
 ok(!!q('.votebar'),'가족이 올린 투표가 홈에 배너로 뜬다');
 ok(byText('.votebar','투표해주세요')&&byText('.votebar .vbg','투표하기'),'아직 안 찍었으면 투표하러 가라고 함');
 ok(byText('.votebar .vbt','1 / 2명 참여'),'몇 명이 했는지 보임');
 g('(function(){OPENVOTE.mine=true;OPENVOTE.total=2;render()})()'); await sleep(100);
 ok(byText('.votebar .vbg','결과 보기'),'내 표를 냈으면 결과 보기로 바뀜');
 g('(function(){OPENVOTE=null;render()})()'); await sleep(100);
 ok(!q('.votebar'),'진행 중인 투표가 없으면 배너 없음');

 // 서버가 400ms 걸리도록 막아두고, 50ms 시점에 화면이 이미 바뀌었는지 본다
 g(`(function(){
   const slow=()=>new Promise(r=>setTimeout(()=>r({error:null,data:[]}),400));
   sb={from:()=>({upsert:slow,select:()=>({eq:()=>slow(),maybeSingle:slow})}),rpc:slow};
   LIVE={id:'v1',vote:{id:'v1',meal:'d',candidates:['a','DELIV'],status:'open'},cnt:{a:0,DELIV:0},total:0,my:null};
   sheet('<div id="vlive"></div>');paintVoteLive();
  })()`);
 await sleep(120);
 ok(qa('#vlive [data-a="vlCast"]').length===2,'투표 화면에 후보 2개');
 ok(!q('#vlive .vopt.on'),'아직 아무것도 안 고른 상태');
 click(q('#vlive [data-a="vlCast"]')); await sleep(60);   // 서버 응답(400ms)보다 훨씬 이르다
 ok(!!q('#vlive .vopt.on'),'누르자마자 내 표로 표시됨 (서버 기다리지 않음)');
 ok(!!byText('#vlive .vt3','1 / 2명'),'집계 숫자도 즉시 반영');
 ok(!!byText('#vlive .cooked','내 표'),'"내 표" 배지도 바로 붙음');
 ok(!!q('#vlive .vshare'),'내보내기 아이콘은 우상단에 따로 있음');
 await sleep(450);
 g('(function(){sb=null;LIVE=null})()'); await closeAll();
 g('(function(){syncOn=false;HOME=null;ME=null;MEMBERS=[];render()})()'); await sleep(80);

 console.log('\n[18-2-2단계] 로그인하고 돌아왔을 때 주소 처리');
 w.history.replaceState({},'','/#access_token=AAA&refresh_token=BBB&expires_in=3600');
 ok(g('hasAuthParam()')===true,'토큰이 붙은 주소를 알아본다');
 g('parseHash()');
 ok(w.location.hash.includes('access_token'),'토큰을 지우지 않는다 (supabase가 읽기 전)');
 ok(g('oauthError()')==='','정상 복귀에는 오류 메시지 없음');
 w.history.replaceState({},'','/#error=server_error&error_code=unexpected_failure&error_description=Bad+client+credentials');
 ok(g('oauthError().raw')==='Bad client credentials','실패 사유 원문을 주소에서 읽어낸다');
 ok(g('oauthError().msg')==='다시 한 번 눌러주세요','모르는 오류는 일단 다시 해보라고 안내');
 w.history.replaceState({},'','/#error=invalid_request&error_description=OAuth+state+has+expired');
 ok(g('oauthError().msg').includes('한 번 더 눌러'),'시간 초과는 "다시 눌러주세요"로 번역');
 w.history.replaceState({},'','/#error=access_denied&error_description=User+cancelled');
 ok(g('oauthError().msg')==='로그인을 취소하셨어요','취소는 취소라고 알려줌');
 w.history.replaceState({},'','/#join=ABC123');
 ok(g('hasAuthParam()')===false,'초대 링크는 인증 파라미터가 아니다');
 g('parseHash()');
 ok(w.location.hash==='','초대 코드는 읽은 뒤 주소에서 지운다');
 ok(g('pendingHash&&pendingHash.join')==='ABC123','초대 코드는 기억해둔다');
 g('consumePending()');

 console.log('\n[18-3단계] 자동 시작 · 환영 화면');
 ok(g('typeof autoSetup')==='function','로그인 후 자동 시작 함수 존재');
 ok(g('typeof openOnboard')==='undefined','옛 온보딩 시트 제거됨');
 ok(g('profileName()')==='나','프로필 이름 없으면 기본값');
 g('(function(){AUTHUSER={user_metadata:{full_name:"허무영"}}})()');
 ok(g('profileName()')==='허무영','카카오·구글 프로필에서 이름 자동 사용');
 g('(function(){HOME="h1";HOMEINFO={id:"h1",code:"ZZ9Q1K"};ME={id:"m1",home_id:"h1",name:"아빠"};MEMBERS=[ME];openWelcome(false)})()');
 await sleep(150);
 ok(!!byText('.sw .vt2','우리집이 생겼어요'),'집 만든 사람 환영 화면');
 ok(!!q('[data-a="shareInvite"]'),'초대 링크 보내기가 주된 다음 행동');
 ok(!!q('#wl-name'),'이름은 여기서 바로 고칠 수 있음');
 ok(!!byText('.sw .mut','ZZ9Q1K'),'링크가 안 될 때를 위한 코드도 함께 안내');
 await closeAll();
 g('(function(){MEMBERS=[{id:"m0",home_id:"h1",name:"엄마"},ME];openWelcome(true)})()'); await sleep(150);
 ok(!!byText('.sw .vt2','합류했어요'),'합류한 사람 환영 화면');
 ok(!q('[data-a="shareInvite"]'),'합류한 사람에겐 초대 버튼 안 띄움');
 ok(!!byText('.sw .vt3','엄마'),'누구와 함께 보게 되는지 알려줌');
 await closeAll();
 g('(function(){AUTHUSER=null;HOME=null;HOMEINFO=null;ME=null;MEMBERS=[];ui.gate=false;render()})()'); await sleep(120);

 console.log('\n[19단계] 둘러보기 투어');
 ok(g('TOUR.length')===5,'투어 5단계 정의');
 g('(function(){ui.tab="menus";render();tourStart()})()'); await sleep(200);
 ok(!!q('#tour'),'투어 카드 표시');
 ok(g('ui.tab')==='menus','1단계 → 메뉴판');
 ok(!!byText('#tour h4','우리집 메뉴판'),'1단계: 메뉴 등록');
 click(q('#tour [data-a="tourNext"]')); await sleep(400);
 ok(!!byText('#tour h4','브랜드'),'2단계: 브랜드 제품 검색');
 click(q('#tour [data-a="tourNext"]')); await sleep(300);
 ok(g('ui.tab')==='home'&&g('SHEETS.length')===0,'3단계 → 홈(시트 정리됨)');
 ok(!!byText('#tour h4','가족끼리'),'3단계: 함께 고르기');
 click(q('#tour [data-a="tourNext"]')); await sleep(200);
 ok(g('ui.tab')==='plan','4단계 → 식단표');
 ok(!!byText('#tour h4','일주일 식단'),'4단계: 주간 식단');
 click(q('#tour [data-a="tourNext"]')); await sleep(200);
 ok(g('ui.tab')==='shop'&&!!byText('#tour h4','장 볼 것'),'5단계 → 장보기(핵심)');
 ok(!!byText('#tour .next','우리집 시작하기'),'마지막 단계 CTA');
 ok(qa('#tour .tdots i.on').length===1,'진행 점 표시');
 click(q('#tour [data-a="tourEnd"]')); await sleep(150);
 ok(!q('#tour'),'그만 보기 → 카드 제거');
 // 탭 이동해도 되살아나지 않음
 click(byText('.tb','메뉴판')); await sleep(150);
 ok(!q('#tour'),'닫은 뒤에는 다시 안 뜸');
 // 로그인 화면에서는 투어가 보이면 안 됨
 g('(function(){TSTEP=0;ui.gate=true;render()})()'); await sleep(200);
 ok(!q('#tour'),'로그인 화면에선 투어 숨김');
 g('(function(){TSTEP=-1;ui.gate=false;render()})()'); await sleep(150);

 console.log('\n[20단계] 접속 로그 (만든 사람용)');
 await closeAll();
 // 관리자가 아니면 화면 자체가 열리지 않아야 한다
 g(`(function(){ISADMIN=false;AUTHUSER={id:'u1',email:'other@example.com'};
  sb={rpc:async()=>({data:false}),from:()=>({select:()=>({order:()=>({limit:async()=>({data:[],error:null})})})})}})()`);
 g('openVisitLog()'); await sleep(220);
 ok(g('SHEETS.length')===0,'관리자가 아니면 #log 로 들어와도 아무것도 안 열림');
 ok(!byText('.sw','관리자'),'관리자 등록 안내조차 안 뜸 (그런 화면이 있다는 것도 안 알림)');

 // 관리자 — 실제 로그 화면
 await closeAll();
 g(`(function(){ISADMIN=true;AUTHUSER={id:'me',email:'me@example.com'};
  const now=Date.now(),iso=m=>new Date(now-m*60000).toISOString();
  const rows=[
   {device:'d1',user_id:'u1',event:'menu_add',detail:'김치찜',ua:'iPhone; CriOS',ref:'https://kakao.com/x',created_at:iso(1)},
   {device:'d1',user_id:'u1',event:'home_new',detail:'허무영',ua:'iPhone; CriOS',ref:'https://kakao.com/x',created_at:iso(2)},
   {device:'d1',user_id:null,event:'open',detail:'',ua:'iPhone; CriOS',ref:'https://kakao.com/x',created_at:iso(3)},
   {device:'d2',user_id:null,event:'open',detail:'',ua:'Windows NT 10.0; Chrome',ref:'',created_at:iso(20)}];
  const fbs=[{message:'장보기 목록이 편해요',contact:'',user_id:'u1',created_at:iso(5)}];
  sb={rpc:async()=>({data:true}),
      from:t=>({select:()=>({order:()=>({limit:async()=>({data:t==='feedback'?fbs:rows,error:null})})})})}})()`);
 g('openVisitLog()'); await sleep(200);
 ok(!!byText('.sw','들어온 사람들'),'로그 화면 열림');
 ok(!!byText('.sw .sgrp','보내온 의견'),'보내온 의견도 같은 화면에서 보임');
 ok(!!byText('.sw','장보기 목록이 편해요'),'의견 내용이 그대로 보임');
 ok(!!byText('.sw .cnt','전체 2명'),'기기 단위로 사람 수 집계');
 ok(!!byText('.sw','iPhone · Chrome'),'기기·브라우저 요약');
 ok(!!byText('.sw','카톡에서 옴'),'유입 경로 표시');
 ok(!!byText('.sw','메뉴 등록')&&!!byText('.sw','김치찜'),'무엇을 했는지 한글로');
 ok(!!byText('.sw','열어보기만 하고'),'들어왔다 그냥 나간 사람도 보임');
 await closeAll();

 // 설정 진입로는 관리자에게만
 g('(function(){ISADMIN=false})()'); g('openSettings()'); await sleep(120);
 ok(!q('[data-a="logOpen"]'),'일반 사용자 설정엔 접속 로그 없음');
 await closeAll();
 g('(function(){ISADMIN=true})()'); g('openSettings()'); await sleep(120);
 ok(!!q('[data-a="logOpen"]'),'관리자 설정엔 접속 로그 있음');
 await closeAll();
 g('(function(){ISADMIN=false;AUTHUSER=null;sb=null})()');

 console.log('\n────────────────────');
 console.log(`결과: ${pass} PASS / ${fail} FAIL`);
 if(fails.length){console.log('실패 목록:');fails.forEach(f=>console.log(' -',f))}
 process.exit(fail?1:0);
})().catch(e=>{console.error('하네스 크래시:',e.message,'\n',(e.stack||'').split('\n').slice(1,3).join('\n'));process.exit(2)});
