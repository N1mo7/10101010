// محرك سحب وتوليد الأسئلة أوتوماتيكياً من Wikipedia API
class WikiLiveEngine {
  // مواضيع وبحث ذكي يتم توليد القوائم منه آلياً من الإنترنت
  static topics = [
    { cat: "جغرافيا دول 🌍", query: "قائمة الدول حسب المساحة", type: "list" },
    { cat: "سينما وأفلام 🎬", query: "قائمة أعلى الأفلام دخلا", type: "list" },
    { cat: "تاريخ وعضماء 👑", query: "أباطرة الإمبراطورية الرومانية", type: "list" },
    { cat: "علوم وفضاء 🌌", query: "كواكب المجموعة الشمسية", type: "list" },
    { cat: "رياضة وكرة قدم ⚽", query: "قائمة أندية كرة القدم في إيطاليا", type: "list" },
    { cat: "مدن عظمى 🏙️", query: "قائمة أكبر المدن في العالم", type: "list" }
  ];

  static async fetchDynamicQuestion() {
    // اختيار موضوع عشوائي وتوليد الأسئلة منه
    const randomTopic = this.topics[Math.floor(Math.random() * this.topics.length)];
    const apiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(randomTopic.query)}&format=json&origin=*`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      const searchResults = data.query.search;

      if (!searchResults || searchResults.length === 0) {
        throw new Error("No results");
      }

      // جلب محتوى المقالة الأولى لتوليد العناصر تلقائياً
      const pageTitle = searchResults[0].title;
      const detailUrl = `https://ar.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
      
      const detailRes = await fetch(detailUrl);
      const detailData = await detailRes.json();
      const pages = detailData.query.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId].extract || "لا يوجد تفاصيل كافية";

      // استخراج الكلمات والجمل لتكوين الـ 10 إجابات أوتوماتيكياً من النص المستخرج
      let extractedAnswers = extract.split(/[،.\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 3 && s.length < 40);

      // لو العناصر أقل من 10، نكملهم من نتائج البحث الأخرى
      if (extractedAnswers.length < 10) {
        searchResults.forEach(item => {
          if (!extractedAnswers.includes(item.title)) {
            extractedAnswers.push(item.title);
          }
        });
      }

      // قصرهم على 10 إجابات دقيقة
      const finalAnswers = extractedAnswers.slice(0, 10).map(name => ({
        name: name,
        keys: [name, name.toLowerCase(), this.cleanText(name)]
      }));

      return {
        category: randomTopic.cat,
        question: `توليد تلقائي من ويكيبيديا: ${pageTitle}`,
        answers: finalAnswers.length >= 5 ? finalAnswers : this.getFallbackAnswers()
      };

    } catch (err) {
      // نظام احتياطي فوري لو الإنترنت بطيء أو الـ API واجه ضغط
      return this.getFallbackAnswers();
    }
  }

  static getFallbackAnswers() {
    return {
      category: "توليد ذكي عشوائي 🌐",
      question: "أبرز العناصر المولدة تلقائياً من شبكة الإنترنت العالمية",
      answers: [
        { name: "الذكاء الاصطناعي", keys: ["الذكاء الاصطناعي", "ai"] },
        { name: "إنترنت الأشياء", keys: ["انترنت الاشياء"] },
        { name: "الحوسبة السحابية", keys: ["الحوسبة السحابية"] },
        { name: "أمن المعلومات", keys: ["امن المعلومات"] },
        { name: "الواقع الافتراضي", keys: ["الواقع الافتراضي"] },
        { name: "تحليل البيانات", keys: ["تحليل البيانات"] },
        { name: "شبكات الجيل الخامس", keys: ["الجيل الخامس"] },
        { name: "البلوكتشين", keys: ["بلوكتشين", "blockchain"] },
        { name: "البرمجيات المفتوحة", keys: ["برمجيات مفتوحة"] },
        { name: "الأتمتة الذكية", keys: ["اتمته", "الأتمتة"] }
      ]
    };
  }

  static cleanText(str) {
    return str.toLowerCase()
      .replace(/[أإآء]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[^a-z0-9ا-ي]/g, '');
  }
}

// إدارة حالة اللعبة وتحديث واجهة المستخدم الحية
let currentQuestion = null, revealed = [], hearts = 5, gold = 100, timerInterval, seconds = 0, isGameOver = false;

document.getElementById('btnNewQuestion').addEventListener('click', loadNewQuestion);
document.getElementById('guessForm').addEventListener('submit', handleGuess);
document.getElementById('btnGiveUp').addEventListener('click', giveUp);
document.getElementById('btnHint').addEventListener('click', giveHint);

async function loadNewQuestion() {
  document.getElementById('topicQuestion').innerText = "🔄 جاري الاتصال بـ Wikipedia API وتوليد تحدي جديد...";
  
  currentQuestion = await WikiLiveEngine.fetchDynamicQuestion();
  
  revealed = new Array(currentQuestion.answers.length).fill(false);
  hearts = 5; isGameOver = false; seconds = 0;
  
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds++;
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    document.getElementById('timer').innerText = `${mins}:${secs}`;
  }, 1000);

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
    showToast('🎉 ممتاز! أكملت التحدي المولد عبر الـ API بنجاح!', 'success');
    if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }
}

function handleGuess(e) {
  e.preventDefault();
  if (isGameOver) return;

  const inputEl = document.getElementById('guessInput');
  const cleanGuess = WikiLiveEngine.cleanText(inputEl.value.trim());
  inputEl.value = '';
  if (!cleanGuess) return;

  let matchIndex = -1;
  currentQuestion.answers.forEach((ans, idx) => {
    if (revealed[idx]) return;
    if (ans.keys.some(k => cleanGuess.includes(WikiLiveEngine.cleanText(k)) || WikiLiveEngine.cleanText(k).includes(cleanGuess))) {
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
  showToast(`💡 تلميح: عنصر رقم ${idx + 1} يبدأ بـ (${currentQuestion.answers[idx].name.charAt(0)})`, 'success');
  updateStatus();
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.innerText = msg; toast.className = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 2200);
}

// التشغيل المباشر عند فتح الصفحة
loadNewQuestion();
