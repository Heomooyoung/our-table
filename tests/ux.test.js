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
 const closeAll=async()=>{while(g('SHEETS.length')){g('shClose()');await sleep(30)} await sleep(320)};
 await sleep(300); // init 대기
 w.scrollTo=()=>{}; // jsdom 미구현 소음 제거
 g('if(window.SVGElement)SVGElement.prototype.getTotalLength=function(){return 120}'); // jsdom 미구현 보강

 console.log('\n[1단계] 첫 실행 · 홈');
 ok(q('#scr .hero'),'홈 히어로 렌더');
 ok(qa('.strip .dcol').length===7,'주간 스트립 7일');
 ok(g('S.menus.length')===1&&g('S.menus[0].name').includes('화덕브레드'),'시드 메뉴 존재');
 console.log('   히어로 버튼:',qa('.hero .acts .btn').map(b=>b.textContent.trim()).join(' / '));
 ok(!q('.connbar'),'서버 불가 환경 → 연결 배너 없음');

 console.log('\n[2단계] 메뉴 등록');
 click('.fab'); await sleep(80);
 ok(q('#f-name'),'등록 시트 열림');
 click(byText('.sw button','메뉴판에 올리기')); await sleep(60);
 ok(toast().includes('이름'),'이름 없이 저장 → 안내');
 type('#f-name','김치찜');
 q('.irow .i-n').value='돼지고기'; q('.irow .i-a').value='300g'; q('.irow .i-b').value='한돈';
 click(byText('.sw button','메뉴판에 올리기')); await sleep(450);
 ok(g('S.menus.length')===2,'메뉴 2개로 증가');
 ok(g('ui.tab')==='menus','저장 후 메뉴판 탭 이동');
 ok(!!byText('.lrow .lnm','김치찜'),'리스트에 김치찜 표시');

 console.log('\n[3단계] 중복 이름 안내');
 click('.fab'); await sleep(80);
 type('#f-name','김치찜');
 click(byText('.sw button','메뉴판에 올리기')); await sleep(60);
 ok(toast().includes('이미'),'중복 1회차 → 경고, 저장 안 됨');
 ok(g('S.menus.length')===2,'아직 2개');
 click(byText('.sw button','메뉴판에 올리기')); await sleep(450);
 ok(g('S.menus.length')===3,'중복 2회차 → 등록됨');
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
 click(byText('.sw button','오늘 해먹었어요')); await sleep(60);
 ok(g('S.menus.find(m=>m.name==="김치찜").cookCount')===1,'해먹기 +1');
 click(byText('.sw button','오늘 해먹었어요')); await sleep(60);
 ok(g('S.menus.find(m=>m.name==="김치찜").cookCount')===1&&toast().includes('이미'),'같은 날 중복 차단');
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
 click(byText('.tb','오늘')); await sleep(80);
 ok(!!byText('#scr .hero .nm','김치찜'),'홈에 오늘의 저녁 공지');
 click(byText('#scr .btn','다시 정하기')); await sleep(80);
 ok(!!q('#scr .hero h1'),'다시 정하기 → 질문 히어로 복귀');

 console.log('\n[7단계] 사다리 (메뉴 2개)');
 click(byText('#scr .btn','사다리')); await sleep(150);
 ok(!!q('.sw .lsvg'),'사다리 시트 열림');
 click(q('.sw .snode')); await sleep(1900);
 const gd=q('.sw #gdecide');
 ok(gd&&q('.sw #gacts').style.visibility==='visible','결과 후 결정 버튼 노출');
 if(gd)click(gd); await sleep(450);
 ok(!!q('#scr .hero .nm'),'사다리 결정 → 오늘 카드');
 ok(!!g('S.plan[todayISO()]&&S.plan[todayISO()].d'),'식단표 오늘 저녁 기록');
 click(byText('#scr .btn','다시 정하기')); await sleep(80);

 console.log('\n[8단계] 장보기 — 자동 취합 · 체크 · 직접 추가');
 click(byText('.tb','식단표')); await sleep(80);
 click(qa('#scr .day.today .slot')[0]); await sleep(80);
 click(byText('.sw .prow .pnm','김치찜').closest('.prow')); await sleep(350);
 click(byText('.tb','장보기')); await sleep(150);
 ok(!!byText('#scr .sitem .snm2','돼지고기'),'재료 자동 취합');
 ok(!!byText('#scr .brand','한돈'),'브랜드 칩');
 ok(!!byText('#scr .sitem .src','김치찜'),'출처 메뉴 표기');
 click(byText('#scr .sitem .snm2','돼지고기').closest('.sitem')); await sleep(80);
 ok(!!q('#scr .sitem.done'),'체크 → 완료 표시');
 type('#xn','대파'); type('#xa','두 단');
 click(byText('#scr .xadd .btn','추가')); await sleep(80);
 ok(!!byText('#scr .sitem .snm2','대파'),'직접 추가 표시');

 console.log('\n[9단계] 가족 돌려찍기 투표');
 click(byText('.tb','오늘')); await sleep(80);
 ok(!!byText('#scr .tbtn','가족 투표'),'결정 상태에도 투표 진입로(수정 반영)');
 click(byText('#scr .tbtn','가족 투표')); await sleep(100);
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
 ok(!!q('#scr .hero .nm'),'투표 결과 → 오늘 카드 반영');

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

 console.log('\n[11단계] 설정 · 가족 명단');
 click('[data-a="settings"]'); await sleep(80);
 ok(!!byText('.sw button','백업 파일 내려받기'),'설정 시트');
 ok(!!byText('.sw button','우리집 계정 연결하기')||!!byText('.sw .mut','로컬 모드'),'미연결 상태 표기');
 click(byText('.sw button','돌려찍기용 가족 명단')); await sleep(80);
 click(qa('.sw [data-a="famDel"]')[0]); await sleep(40);
 ok(g('S.family.length')===1,'가족 삭제 동작');
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
 click(preItems[0]); await sleep(120);
 const sitems=qa('#scr .sitem');
 ok(!sitems[0].classList.contains('done')&&sitems[sitems.length-1].classList.contains('done'),'체크 항목이 아래로 가라앉음');
 click(byText('.tb','메뉴판')); await sleep(80);
 type('#q','없는메뉴zzz'); await sleep(550);
 ok(!!byText('#scr .empty b','조건에 맞는'),'검색 무결과 전용 문구');
 type('#q',''); await sleep(550);

 console.log('\n[13단계] 메모 붙여넣기 등록 (규칙 파서)');
 const parsed=g(`parseRecipes("된장찌개\\n재료: 두부 반 모, 애호박 1/2개, 된장 2큰술(해찬들)\\n1. 물 끓이기\\n2. 된장 풀기\\n메모: 멸치육수면 더 좋음")`);
 ok(parsed.length===1&&parsed[0].name==='된장찌개','파서: 이름 추출');
 ok(parsed[0].ingredients.length===3&&parsed[0].ingredients[0].name==='두부'&&parsed[0].ingredients[0].amount.includes('반'),'파서: 재료·양 분리');
 ok(parsed[0].ingredients[2].brand==='해찬들','파서: 괄호 → 브랜드');
 ok(parsed[0].steps.length===2,'파서: 단계 2개');
 ok(parsed[0].memo.includes('멸치'),'파서: 메모 분류');
 click('.fab'); await sleep(80);
 click(byText('.sw button','메모 붙여넣기')); await sleep(80);
 q('#pz').value='간장계란밥\n재료: 계란 2알, 간장 1큰술';
 click(byText('.sw button','분석해서 채우기')); await sleep(200);
 ok(q('#f-name').value==='간장계란밥','단일 → 폼 자동 채움');
 ok(qa('#ingRows .irow').length===2,'재료 2줄 채워짐');
 click(byText('.sw button','메뉴판에 올리기')); await sleep(450);
 ok(!!byText('.lrow .lnm','간장계란밥'),'붙여넣기 등록 완료');
 const cnt=g('S.menus.length');
 click('.fab'); await sleep(80);
 click(byText('.sw button','메모 붙여넣기')); await sleep(80);
 q('#pz').value='제육볶음\n돼지고기 300g, 고추장 2큰술\n\n콩나물국\n콩나물 한 줌';
 click(byText('.sw button','분석해서 채우기')); await sleep(200);
 ok(!!byText('.sw h2','2개'),'빈 줄 구분 → 여러 메뉴 감지');
 click(byText('.sw button','전부 메뉴판에 올리기')); await sleep(450);
 ok(g('S.menus.length')===cnt+2,'벌크 2개 등록');

 console.log('\n────────────────────');
 console.log(`결과: ${pass} PASS / ${fail} FAIL`);
 if(fails.length){console.log('실패 목록:');fails.forEach(f=>console.log(' -',f))}
 process.exit(fail?1:0);
})().catch(e=>{console.error('하네스 크래시:',e.message,'\n',(e.stack||'').split('\n').slice(1,3).join('\n'));process.exit(2)});
