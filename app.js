// المحرك الرئيسي للاتصال بـ Wikidata و Wikipedia API
class WikidataEngine {
  // قائمة استعلامات SPARQL جاهزة تجلب قوائم Top 10 ديناميكياً بدون أي تدخل يدوي
  static queries = [
    {
      category: "جغرافيا وتاريخ 🌍",
      question: "أكبر 10 دول في العالم من حيث المساحة",
      sparql: `
        SELECT ?itemLabel (MAX(?area) AS ?val) WHERE {
          ?item wdt:P31 wd:Q3624078 ; wdt:P2046 ?area .
          SERVICE wikibase:label { bd:serviceParam wikibase:language "ar,en". }
        } GROUP BY ?itemLabel ORDER BY DESC(?val) LIMIT 10
      `
    },
    {
      category: "سينما وفن 🎬",
      question: "أعلى 10 أفلام تحقيقاً للإيرادات في تاريخ السينما",
      sparql: `
        SELECT ?itemLabel (MAX(?boxOffice) AS ?val) WHERE {
          ?item wdt:P31 wd:Q11424 ; wdt:P2142 ?boxOffice .
          SERVICE wikibase:label { bd:serviceParam wikibase:language "ar,en". }
        } GROUP BY ?itemLabel ORDER BY DESC(?val) LIMIT 10
      `
    },
    {
      category: "كرة قدم ورياضة ⚽",
      question: "أكثر المنتخبات مشاركة وفوزاً بالمباريات في كأس العالم",
      sparql: `
        SELECT ?itemLabel (COUNT(?match) AS ?val) WHERE {
          ?match wdt:P31 wd:Q19317 ; wdt:P3415 ?item .
          SERVICE wikibase:label { bd:serviceParam wikibase:language "ar,en". }
        } GROUP BY ?itemLabel ORDER BY DESC(?val) LIMIT 10
      `
    }
  ];

  static async fetchQuestion() {
    const randomQuery = this.queries[Math.floor(Math.random() * this.queries.length)];
    const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(randomQuery.sparql) + '&format=json';

    try {
      const response = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } });
      const data = await response.json();
      
      const answers = data.results.bindings.map(b => {
        const name = b.itemLabel.value;
        return {
          name: name,
          keys: [name, name.toLowerCase(), this.cleanText(name)]
        };
      });

      return {
        source: "Wikidata Live API 🌐",
        category: randomQuery.category,
        question: randomQuery.question,
        answers: answers
      };
    } catch (e) {
      // Backup to Open Trivia DB
      return await this.fetchOpenTrivia();
    }
  }

  static async fetchOpenTrivia() {
    const res = await fetch('https://opentdb.com/api.php?amount=10&type=multiple');
    const data = await res.json();
    const answers = data.results.map(item => {
      const txt = this.decodeHTML(item.correct_answer);
      return { name: txt, keys: [txt, txt.toLowerCase(), this.cleanText(txt)] };
    });

    return {
      source: "OpenTrivia DB API 🌐",
      category: data.results[0].category,
      question: `تحدي توب 10: خمن الإجابات الـ 10 الصحيحة في ${data.results[0].category}`,
      answers: answers
    };
  }

  static cleanText(str) {
    return str.toLowerCase()
      .replace(/[أإآء]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[^a-z0-9ا-ي]/g, '');
  }

  static decodeHTML(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }
}

// كود التحكم وإدارة اللعبة بالكامل
let currentQuestion = null, revealed = [], hearts = 5, gold = 100, timerInterval, seconds = 0, isGameOver = false;

document.getElementById('btnNewQuestion').addEventListener('click', loadNewQuestion);
document.getElementById('guessForm').addEventListener('submit', handleGuess);
document.getElementById('btnGiveUp').addEventListener('click', giveUp);
document.getElementById('btnHint').addEventListener('click', giveHint);

async function loadNewQuestion() {
  document.getElementById('topicQuestion').innerText = "جاري السحب المباشر من API ويكيبيديا وWikidata...";
  currentQuestion = await WikidataEngine.fetchQuestion();
  
  revealed = new Array(currentQuestion.answers.length).fill(false);
  hearts = 5; isGameOver = false; seconds = 0;
  
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds++;
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    document.getElementById('timer').innerText = `${mins}:${secs}`;
  }, 1000);

  document.getElementById('topicSource').innerText = currentQuestion.source;
  document.getElementById('topicCategory').innerText = currentQuestion.category;
  document.getElementById('topicQuestion').innerText = currentQuestion.question;

  renderGrid();
  updateStatus();
}

function renderGrid() {
  const grid = document.getElementById('itemsGrid');
  grid.innerHTML = '';
  currentQuestion.answers.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'item-card' + (revealed[index] ? ' revealed' : '');
    card.id = `card-${index}`;
    card.innerHTML = `<div class="item-rank">${index + 1}</div><div class="item-text">${revealed[index] ? item.name : '؟ ؟ ؟ ؟ ؟ ؟ ؟ ؟'}</div>`;
    grid.appendChild(card);
  });
}

function updateStatus() {
  const foundCount = revealed.filter(Boolean).length;
  document.getElementById('foundCount').innerText = foundCount;
  document.getElementById('hearts').innerText = '❤️'.repeat(hearts) + '🖤'.repeat(5 - hearts);
  document.getElementById('goldCoins').innerText = gold;

  if (foundCount === currentQuestion.answers.length && !isGameOver) {
    isGameOver = true; clearInterval(timerInterval);
    gold += 50; updateStatus();
    showToast('🎉 كفووو! كملت القائمة من Wikidata!', 'success');
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }
}

function handleGuess(e) {
  e.preventDefault();
  if (isGameOver) return;

  const inputEl = document.getElementById('guessInput');
  const rawGuess = inputEl.value.trim();
  const cleanGuess = WikidataEngine.cleanText(rawGuess);
  inputEl.value = '';
  if (!cleanGuess) return;

  let matchIndex = -1;
  currentQuestion.answers.forEach((ans, idx) => {
    if (revealed[idx]) return;
    if (ans.keys.some(k => cleanGuess.includes(WikidataEngine.cleanText(k)) || WikidataEngine.cleanText(k).includes(cleanGuess))) {
      matchIndex = idx;
    }
  });

  if (matchIndex !== -1) {
    revealed[matchIndex] = true; gold += 10;
    renderGrid(); updateStatus();
    showToast('إجابة صحيحة! +10 💰', 'success');
  } else {
    hearts--; updateStatus();
    showToast('إجابة خاطئة! ❌', 'error');
    if (hearts <= 0) { isGameOver = true; clearInterval(timerInterval); giveUp(); }
  }
}

function giveUp() {
  currentQuestion.answers.forEach((ans, idx) => {
    if (!revealed[idx]) {
      const card = document.getElementById(`card-${idx}`);
      if (card) {
        card.classList.add('failed-reveal');
        card.querySelector('.item-text').innerText = ans.name;
      }
    }
  });
  isGameOver = true; clearInterval(timerInterval);
}

function giveHint() {
  if (isGameOver) return;
  if (gold < 20) { showToast('ليس لديك ذهب كافٍ! ❌', 'error'); return; }
  const unrevealed = revealed.map((v, i) => v ? -1 : i).filter(i => i !== -1);
  if (!unrevealed.length) return;
  gold -= 20;
  const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
  showToast(`💡 تلميح: رقم ${idx + 1} يبدأ بـ (${currentQuestion.answers[idx].name.charAt(0)})`, 'success');
  updateStatus();
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.innerText = msg; toast.className = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 2200);
}

// بدء التشغيل عند الفتح
loadNewQuestion();
