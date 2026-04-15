// Mock BMTC major hubs
const bmtcHubs = [
    "Majestic (KBS)",
    "Silk Board Jct",
    "Hebbal",
    "Whitefield TTMC",
    "Koramangala",
    "Indiranagar",
    "Electronic City Phase 1",
    "Malleswaram",
    "Jayanagar 4th Block",
    "Yeshwanthpur TTMC",
    "KR Market",
    "Banashankari TTMC",
    "Marathahalli Bridge",
    "Byderahalli",
    "Kengeri",
    "Sapthagiri College",
    "Hessarghatta",
    "BTM Layout"
];

const sourceInput = document.getElementById('source');
const destInput = document.getElementById('destination');
const sourceDropdown = document.getElementById('source-dropdown');
const destDropdown = document.getElementById('dest-dropdown');
const swapBtn = document.getElementById('swap-routes');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results');

// UI Elements for Ticket
const ticketFrom = document.getElementById('ticket-from');
const ticketTo = document.getElementById('ticket-to');
const ticketPrice = document.getElementById('ticket-price');
const ticketId = document.getElementById('ticket-id');
const ticketDate = document.getElementById('ticket-date');

// Set current date on ticket
const now = new Date();
ticketDate.innerText = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// UI Elements for Aadhaar/Shakti Scheme
const aadhaarContainer = document.getElementById('aadhaar-container');
const aadhaarInput = document.getElementById('aadhaar-number');
const scanBtn = document.getElementById('scan-aadhaar-btn');
const qrModal = document.getElementById('qr-modal');
const closeModalBtn = document.getElementById('close-modal');
const demoScanBtn = document.getElementById('demo-scan-btn');
const flipCameraBtn = document.getElementById('flip-camera-btn');
const camLabel = document.getElementById('cam-label');
const scannerStatus = document.getElementById('scanner-status');
const qrVideo = document.getElementById('qr-video');
const qrCanvas = document.getElementById('qr-canvas');

let cameraStream = null;
let scanInterval = null;
let ocrWorker = null;
let isScanning = false;         // prevent overlapping OCR calls
let currentFacingMode = 'environment'; // 'environment' = rear, 'user' = selfie
let karnatakaVerified = false;
let dobVerified = false;
let genderVerified = false;
let capturedPassType = 'adult';
let capturedAadhaar = '';

let selectedGender = 'female';
let selectedCategory = 'adult';

// Payment & GPS Variables
const btnGps = document.getElementById('btn-gps');
const paymentModal = document.getElementById('payment-modal');
const closePaymentModal = document.getElementById('close-payment-modal');
const paymentAmountLabel = document.getElementById('payment-amount');
const paymentQrImg = document.getElementById('payment-qr-img');
const simulatePaymentBtn = document.getElementById('simulate-payment-btn');

let pendingTicketPassType = null;
let paymentDoneForCurrentJourney = false;

// Fare chart
const fareChart = [
    { max: 2, adult: 6, child: 3, senior: 5 },
    { max: 4, adult: 12, child: 6, senior: 9 },
    { max: 6, adult: 18, child: 9, senior: 14 },
    { max: 8, adult: 23, child: 12, senior: 18 },
    { max: 10, adult: 23, child: 12, senior: 18 },
    { max: 12, adult: 24, child: 12, senior: 18 },
    { max: 14, adult: 24, child: 12, senior: 18 },
    { max: 16, adult: 28, child: 14, senior: 21 },
    { max: 18, adult: 28, child: 14, senior: 21 },
    { max: 20, adult: 28, child: 14, senior: 21 },
    { max: 22, adult: 30, child: 15, senior: 23 },
    { max: 24, adult: 30, child: 15, senior: 23 },
    { max: 26, adult: 30, child: 15, senior: 23 },
    { max: 28, adult: 30, child: 15, senior: 23 },
    { max: 30, adult: 30, child: 15, senior: 23 },
    { max: 32, adult: 30, child: 15, senior: 23 },
    { max: 34, adult: 30, child: 15, senior: 23 },
    { max: 36, adult: 30, child: 15, senior: 23 },
    { max: 38, adult: 30, child: 15, senior: 23 },
    { max: 40, adult: 30, child: 15, senior: 23 },
    { max: 42, adult: 32, child: 16, senior: 24 },
    { max: 44, adult: 32, child: 16, senior: 24 },
    { max: 46, adult: 32, child: 16, senior: 24 },
    { max: 48, adult: 32, child: 16, senior: 24 },
    { max: 50, adult: 32, child: 16, senior: 24 }
];

function getFare(distance, type) {
    let prevMax = 0;
    for (let slab of fareChart) {
        if (distance > prevMax && distance <= slab.max) {
            return slab[type] || slab.adult;
        }
        prevMax = slab.max;
    }
    return fareChart[fareChart.length - 1][type];
}

// Generate a consistent pseudo-random distance based on the route
function getDistance(src, dest) {
    if (!src || !dest || src === dest) return 0;
    let hash = 0;
    const stringVal = src + dest;
    for (let i = 0; i < stringVal.length; i++) {
        hash = stringVal.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Returns a distance between 2km and 45km
    return Math.floor(Math.abs(hash) % 44) + 2;
}

// ── Audio feedback (Web Audio API — no external files needed) ─────────────────
function playSuccessSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Two rising tones: pleasant "verified" chime
    [[523, 0], [784, 0.18]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.4, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.4);
    });
}

function playFailSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Low descending buzzer: "error / denied"
    [[260, 0], [220, 0.2]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.35);
    });
}

function playLoudAlarm() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Three harsh repeated bursts — maximum volume alarm
    [0, 0.25, 0.5, 0.75, 1.0].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime + delay);
        gain.gain.setValueAtTime(1.5, ctx.currentTime + delay);          // max loud
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.22);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.22);
    });
}
// ─────────────────────────────────────────────────────────────────────────────

// Aadhaar container is now always visible

// Helper: format a 12-digit number as "XXXX XXXX XXXX"
function formatAadhaar(digits) {
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += digits[i];
    }
    return formatted.substring(0, 14);
}

// Generate a random-looking demo Aadhaar
function randomAadhaar() {
    const seg = () => Math.floor(Math.random() * 9000) + 1000;
    return `${seg()} ${seg()} ${seg()}`;
}

// Stop camera, intervals, and terminate OCR worker
async function stopCamera() {
    if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    qrVideo.srcObject = null;
    if (ocrWorker) {
        await ocrWorker.terminate();
        ocrWorker = null;
    }
    isScanning = false;
}

// Capture one frame from the video into the canvas and run OCR
async function captureAndRecognize() {
    if (isScanning || qrVideo.readyState < qrVideo.HAVE_ENOUGH_DATA) return;
    isScanning = true;
    scannerStatus.textContent = '🔍 Reading text from card…';

    try {
        // ── Image preprocessing for better OCR accuracy ──────────────────
        // Scale up 3× so Tesseract has more pixels to work with for smaller text
        const SCALE = 3;
        qrCanvas.width = qrVideo.videoWidth * SCALE;
        qrCanvas.height = qrVideo.videoHeight * SCALE;
        const ctx = qrCanvas.getContext('2d');

        // Draw scaled-up video frame
        ctx.drawImage(qrVideo, 0, 0, qrCanvas.width, qrCanvas.height);

        // Convert to grayscale + boost contrast — helps OCR on dark/blurry cards
        const imageData = ctx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
        const d = imageData.data;
        const contrast = 60; // 0–100: higher = sharper text edges
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        for (let i = 0; i < d.length; i += 4) {
            // Greyscale
            const grey = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            // Contrast stretch
            const c = factor * (grey - 128) + 128;
            d[i] = d[i + 1] = d[i + 2] = Math.min(255, Math.max(0, c));
        }
        ctx.putImageData(imageData, 0, 0);
        // ─────────────────────────────────────────────────────────────────

        const { data: { text } } = await ocrWorker.recognize(qrCanvas);
        const lower = text.toLowerCase();
        console.log('OCR text:', text);

        // ── Fuzzy match for "Karnataka" ───────────────────────────────────
        const karnatakAFound =
            lower.includes('karnataka') ||
            lower.includes('karmataka') ||
            /k[a4]rn[a4]t[a4]k[a4]/.test(lower);
        // ─────────────────────────────────────────────────────────────────

        if (karnatakAFound) {
            karnatakaVerified = true;
        }

        // Check male/female to enable Shakti
        let isFemale = false;
        // Aggressive fuzzy match for "Female" accounting for Tesseract misreads
        const noSpaceText = lower.replace(/\s+/g, '');
        if (/(?:female|femaie|femate|famale|fomele|fema1e)/i.test(noSpaceText) || /fe\s*ma\s*le/i.test(lower)) {
            isFemale = true;
            genderVerified = true;
            capturedPassType = 'shakti'; // Female overrides to free
        }

        if (!isFemale && /male/i.test(noSpaceText)) {
            genderVerified = true;
            if (capturedPassType === 'adult') {
                capturedPassType = 'male';
            }
        }

        // Scan Date of Birth for Senior Citizen Status
        // Fix common OCR errors: O/o -> 0, l/i -> 1
        const normalizedText = text.replace(/[oO]/g, '0').replace(/[liI]/g, '1');

        // Pattern 1: Match standard dates -> DD/MM/YYYY
        const dateMatch = normalizedText.match(/\d{2}[\/\-\.]\d{2}[\/\-\.]((?:19|20)\d{2})/);
        // Pattern 2: Match Year keywords -> "Year of Birth : 1963", "DOB : 1955"
        const keywordMatch = normalizedText.match(/(?:birth|dob|d0b|yob|yo\b).*?((?:19|20)\d{2})/i);

        let yob = null;
        if (dateMatch) {
            yob = parseInt(dateMatch[1], 10);
        } else if (keywordMatch) {
            yob = parseInt(keywordMatch[1], 10);
        }

        if (yob) {
            dobVerified = true;
            const currentYear = new Date().getFullYear();
            if (yob > 1900) {
                const age = currentYear - yob;
                if (capturedPassType !== 'shakti') {
                    if (age >= 60) {
                        capturedPassType = 'senior';
                    } else if (age <= 6) {
                        capturedPassType = 'infant';
                    } else if (age <= 11) {
                        capturedPassType = 'child';
                    } else {
                        capturedPassType = 'male';
                    }
                }
            }
        }

        // Try caching UID if caught in any frame
        const uidMatch = text.match(/\d{4}\s?\d{4}\s?\d{4}/);
        if (uidMatch && !capturedAadhaar) {
            capturedAadhaar = uidMatch[0].replace(/\D/g, '');
        }

        // Evaluate completion requirements dynamically based on Gender
        let isComplete = false;
        let promptText = '';

        if (genderVerified && capturedPassType === 'shakti') {
            // Female Scenario: Needs Karnataka + Gender (DOB is bypassed)
            if (karnatakaVerified) {
                isComplete = true;
            } else {
                promptText = `✅ Female verified! Please scan 'Karnataka' at the top...`;
            }
        } else if (genderVerified && capturedPassType !== 'shakti') {
            // Male Scenario: Needs Gender + DOB (Karnataka is bypassed)
            if (dobVerified) {
                isComplete = true;
            } else {
                promptText = `✅ Male verified! Please scan DOB (Year of birth)...`;
            }
        } else {
            // Gender NOT verified yet. Track whatever data we can grab.
            if (karnatakaVerified && dobVerified) {
                promptText = `✅ Karnataka & DOB ok! Now scan Gender...`;
            } else if (karnatakaVerified) {
                promptText = `✅ Karnataka verified! Now scan Gender...`;
            } else if (dobVerified) {
                promptText = `✅ DOB verified! Now scan Gender...`;
            } else {
                promptText = `📷 Scan 'Karnataka', Gender, or DOB...`;
            }
        }

        if (!isComplete) {
            const snippet = text.replace(/\n/g, ' ').substring(0, 25).trim();
            scannerStatus.textContent = `${promptText} [Seen: "${snippet || 'Nothing'}"]`;
            isScanning = false;
            return;
        }

        // ✅ Found Karnataka + DOB + Gender!
        clearInterval(scanInterval);
        scanInterval = null;

        // 1️⃣ Close the modal right away so it's out of the way
        qrModal.classList.remove('active');

        // 2️⃣ Fill Aadhaar number automatically
        // Use cached UID if we caught it in earlier frames, else make up one
        aadhaarInput.value = capturedAadhaar.length >= 12
            ? formatAadhaar(capturedAadhaar)
            : randomAadhaar();

        setTimeout(() => {
            generateTicket(capturedPassType);
        }, 350);

        // 4️⃣ Clean up camera + OCR worker in the background
        stopCamera();
        scannerStatus.textContent = 'Hold your Aadhaar card in front of the camera.';
    } catch (err) {
        console.warn('OCR error:', err);
        scannerStatus.textContent = '⚠️ Could not read card. Try again.';
        isScanning = false;
    }
}

// Start camera + Tesseract OCR worker
async function startCamera(facingMode = currentFacingMode) {
    currentFacingMode = facingMode;
    karnatakaVerified = false;
    dobVerified = false;
    genderVerified = false;
    capturedPassType = 'adult';
    capturedAadhaar = '';
    scannerStatus.textContent = 'Starting camera…';

    // Mirror video for selfie, normal for rear
    qrVideo.style.transform = facingMode === 'user' ? 'scaleX(-1)' : '';
    camLabel.textContent = facingMode === 'user' ? '🤳 Selfie' : '📷 Rear';

    try {
        // Start camera
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode }
        });
        qrVideo.srcObject = cameraStream;
        await qrVideo.play();

        // Load Tesseract OCR worker (reuse if already loaded)
        if (!ocrWorker) {
            scannerStatus.textContent = 'Loading OCR engine…';
            ocrWorker = await Tesseract.createWorker('eng');
        }
        scannerStatus.textContent = 'Hold your Aadhaar card in front of the camera.';

        // Run OCR every 1.5 seconds for snappier continuous checking
        if (!scanInterval) {
            scanInterval = setInterval(captureAndRecognize, 1500);
        }

    } catch (err) {
        scannerStatus.textContent = '⚠️ Camera not available. Use the demo button below.';
        console.warn('Camera/OCR start error:', err);
    }
}

// Flip between rear and selfie camera
flipCameraBtn.addEventListener('click', async () => {
    // Stop only the camera stream (keep OCR worker alive)
    if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    qrVideo.srcObject = null;
    isScanning = false;

    const newMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    await startCamera(newMode);
});

// Open modal and start camera + OCR
scanBtn.addEventListener('click', () => {
    qrModal.classList.add('active');
    startCamera();
});

// Demo button — skip camera, fill a fake Aadhaar and auto-show ticket
demoScanBtn.addEventListener('click', async () => {
    await stopCamera();
    qrModal.classList.remove('active');
    aadhaarInput.value = randomAadhaar();
    scannerStatus.textContent = 'Hold your Aadhaar card in front of the camera.';
    generateTicket('shakti');
});

// Close modal
closeModalBtn.addEventListener('click', async () => {
    await stopCamera();
    qrModal.classList.remove('active');
    scannerStatus.textContent = 'Hold your Aadhaar card in front of the camera.';
});

// Format Aadhaar Input (optional spaces)
aadhaarInput.addEventListener('input', function (e) {
    let target = e.target;
    let val = target.value.replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < val.length; i++) {
        if (i > 0 && i % 4 === 0) {
            formatted += ' ';
        }
        formatted += val[i];
    }
    target.value = formatted.substring(0, 14); // 12 digits + 2 spaces
});

// Function to handle autocomplete
function setupAutocomplete(inputElement, dropdownElement) {
    inputElement.addEventListener('input', function () {
        const val = this.value;
        dropdownElement.innerHTML = '';

        if (!val) {
            dropdownElement.classList.remove('active');
            return;
        }

        const matches = bmtcHubs.filter(hub => hub.toLowerCase().includes(val.toLowerCase()));

        if (matches.length > 0) {
            dropdownElement.classList.add('active');
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'dropdown-item';
                div.innerHTML = `<i class='bx bx-map'></i> ${match}`;
                div.addEventListener('click', function () {
                    inputElement.value = match;
                    dropdownElement.classList.remove('active');
                });
                dropdownElement.appendChild(div);
            });
        } else {
            dropdownElement.classList.remove('active');
        }
    });

    // Close autocomplete on click outside
    document.addEventListener('click', function (e) {
        if (e.target !== inputElement) {
            dropdownElement.classList.remove('active');
        }
    });
}

setupAutocomplete(sourceInput, sourceDropdown);
setupAutocomplete(destInput, destDropdown);

// GPS Button Logic
btnGps.addEventListener('click', () => {
    // Add small animation feedback
    btnGps.style.transform = 'scale(0.9)';
    btnGps.innerHTML = "<i class='bx bx-loader bx-spin'></i>";

    // Helper to reset button
    const resetGpsButton = (useRandom = false) => {
        btnGps.style.transform = '';
        btnGps.innerHTML = "<i class='bx bx-current-location'></i>";
        if (useRandom) {
            const randomHub = bmtcHubs[Math.floor(Math.random() * bmtcHubs.length)];
            sourceInput.value = randomHub;
        }
        paymentDoneForCurrentJourney = false;
        resultsContainer.classList.remove('active');
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Use reverse geocoding API to get address
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
                .then(res => res.json())
                .then(data => {
                    btnGps.style.transform = '';
                    btnGps.innerHTML = "<i class='bx bx-current-location'></i>";

                    let address = 'Unknown Location';
                    if (data && data.address) {
                        address = data.address.suburb || data.address.city_district || data.address.road || data.display_name.split(',')[0];
                        // Add a default suffix logic to make it look like a bus stop
                        if (!address.toLowerCase().includes('stop') && !address.toLowerCase().includes('stage') && !address.toLowerCase().includes('layout')) {
                            address += " (Stop)";
                        }
                    }
                    sourceInput.value = address;
                    paymentDoneForCurrentJourney = false;
                    resultsContainer.classList.remove('active');
                })
                .catch(() => {
                    // Fallback to old random hub if api fails
                    resetGpsButton(true);
                });
        }, () => {
            // Permission denied or error
            resetGpsButton(true);
        }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
ge    } else {
        resetGpsButton(true);
    }
});

// Reset payment status when destination changes
destInput.addEventListener('input', () => {
    paymentDoneForCurrentJourney = false;
    resultsContainer.classList.remove('active');
});

sourceInput.addEventListener('input', () => {
    paymentDoneForCurrentJourney = false;
    resultsContainer.classList.remove('active');
});

// Swap routes functionality
swapBtn.addEventListener('click', () => {
    // Add small animation feedback
    swapBtn.style.transform = 'translate(-50%, -10%) scale(0.9)';
    setTimeout(() => swapBtn.style.transform = '', 150);

    const temp = sourceInput.value;
    sourceInput.value = destInput.value;
    destInput.value = temp;
});

// ── Ticket Generation ────────────────────────────────────────────────────────
function generateTicket(passType = 'adult') {
    let sourceVal = sourceInput.value.trim();
    let destVal = destInput.value.trim();

    // If routes aren't filled yet, use defaults so the ticket still shows
    if (!sourceVal) sourceVal = 'Majestic (KBS)';
    if (!destVal) destVal = 'Silk Board Jct';
    if (sourceVal === destVal) destVal = 'Electronic City Phase 1';

    // Push defaults back into the inputs so the user can see them
    sourceInput.value = sourceVal;
    destInput.value = destVal;

    const formatName = (name) => name.length > 15 ? name.substring(0, 15) + '…' : name;
    ticketFrom.innerText = formatName(sourceVal);
    ticketTo.innerText = formatName(destVal);

    const distance = getDistance(sourceVal, destVal);

    // Grab the 2nd h4 inside detail-item (which corresponds to Passengers)
    const passengersElem = document.querySelectorAll('.detail-item h4')[1];

    if (passType === 'shakti') {
        ticketPrice.innerText = '₹0';
        ticketPrice.style.color = '#00d26a';
        if (passengersElem) passengersElem.innerText = '1 Adult Female (Shakti)';
    } else if (passType === 'infant') {
        ticketPrice.innerText = '₹0';
        ticketPrice.style.color = '#00d26a';
        if (passengersElem) passengersElem.innerText = '1 Child (Free)';
    } else if (passType === 'senior') {
        const fare = getFare(distance, 'senior');
        ticketPrice.innerText = `₹${fare}`;
        ticketPrice.style.color = '';
        if (passengersElem) passengersElem.innerText = '1 Senior Citizen (Male)';
    } else if (passType === 'child') {
        const fare = getFare(distance, 'child');
        ticketPrice.innerText = `₹${fare}`;
        ticketPrice.style.color = '';
        if (passengersElem) passengersElem.innerText = '1 Child (Male)';
    } else {
        const fare = getFare(distance, 'adult');
        ticketPrice.innerText = `₹${fare}`;
        ticketPrice.style.color = '';
        if (passengersElem) {
            passengersElem.innerText = passType === 'male' ? '1 Adult (Male)' : '1 Adult';
        }
    }

    const randomId = Math.floor(Math.random() * 90000) + 10000;
    const randomChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    ticketId.innerText = `TKT-${randomId}${randomChar}`;

    // Update date
    const now = new Date();
    ticketDate.innerText = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Show with animation
    resultsContainer.classList.remove('active');
    void resultsContainer.offsetWidth;   // trigger reflow
    resultsContainer.classList.add('active');

    // Play success sound
    playSuccessSound();

    // Save to local storage for history
    const ticketObj = {
        id: ticketId.innerText,
        date: ticketDate.innerText,
        from: formatName(sourceVal),
        to: formatName(destVal),
        price: ticketPrice.innerText,
        passenger: passengersElem ? passengersElem.innerText : '1 Adult'
    };
    let history = JSON.parse(localStorage.getItem('bmtc_ticket_history') || '[]');
    history.unshift(ticketObj);
    localStorage.setItem('bmtc_ticket_history', JSON.stringify(history));

    // Smooth scroll to ticket
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
}

// Search button — validate inputs then generate ticket
searchBtn.addEventListener('click', () => {
    const sourceVal = sourceInput.value.trim();
    const destVal = destInput.value.trim();

    if (!sourceVal || !destVal) {
        alert('Please enter both Source and Destination.');
        return;
    }
    if (sourceVal === destVal) {
        alert('Source and Destination cannot be the same.');
        return;
    }

    let passType = 'adult';

    // If Aadhaar section is currently VISIBLE, we note the pass types but do not strictly enforce validation length here
    if (aadhaarSectionDiv.style.display !== 'none') {
        if (selectedGender === 'female') {
            passType = 'shakti';
        } else if (selectedGender === 'male') {
            if (selectedCategory === 'child') passType = 'child';
            else if (selectedCategory === 'senior') passType = 'senior';
        }
    } else {
        // Aadhaar NOT required (Male Adult)
        if (selectedGender === 'male') {
            passType = 'male';
        }
    }

    const dist = getDistance(sourceVal, destVal);
    let fare = 0;

    if (passType === 'shakti' || passType === 'infant') {
        fare = 0;
    } else if (passType === 'senior') {
        fare = getFare(dist, 'senior');
    } else if (passType === 'child') {
        fare = getFare(dist, 'child');
    } else {
        fare = getFare(dist, 'adult');
    }

    if (fare > 0 && !paymentDoneForCurrentJourney) {
        // Show Payment Modal First
        pendingTicketPassType = passType;
        paymentAmountLabel.innerText = `₹${fare}`;

        // Generate a dynamic mock UPI QR code URL (example uses an API)
        const vpa = "bmtc@sbi";
        const name = "BMTC_Ticketing";
        const upiUri = `upi://pay?pa=${vpa}&pn=${name}&am=${fare}&cu=INR`;
        paymentQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}&bgcolor=ffffff&color=000000`;

        paymentModal.classList.add('active');
        return;
    }

    generateTicket(passType);
});

// Mock Simulate Payment Button
simulatePaymentBtn.addEventListener('click', () => {
    paymentDoneForCurrentJourney = true;
    paymentModal.classList.remove('active');
    setTimeout(() => {
        generateTicket(pendingTicketPassType);
    }, 300);
});

closePaymentModal.addEventListener('click', () => {
    paymentModal.classList.remove('active');
});

// Tab switching logic (Main Pass forms vs Single Journey)
const tabs = document.querySelectorAll('.search-tabs > .tab:not(.gender-tab, .category-tab)');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Hide ticket if user switches to pass
        resultsContainer.classList.remove('active');
        sourceInput.value = '';
        destInput.value = '';
    });
});

// UI toggles for Passenger Gender and Category
const genderTabsList = document.querySelectorAll('.gender-tab');
const categoryTabsList = document.querySelectorAll('.category-tab');
const maleCategoriesDiv = document.getElementById('male-categories');
const aadhaarSectionDiv = document.getElementById('aadhaar-section');
const aadhaarLabelObj = document.getElementById('aadhaar-label');

function updateAadhaarVisibility() {
    if (selectedGender === 'female') {
        aadhaarSectionDiv.style.display = 'block';
        aadhaarLabelObj.innerText = 'Verify Aadhaar for Shakti Scheme';
    } else if (selectedGender === 'male' && (selectedCategory === 'child' || selectedCategory === 'senior')) {
        aadhaarSectionDiv.style.display = 'block';
        aadhaarLabelObj.innerText = `Verify Age for ${selectedCategory === 'child' ? 'Student Concession' : 'Senior Citizen Discount'}`;
    } else {
        aadhaarSectionDiv.style.display = 'none';
        // Clear value if hidden
        aadhaarInput.value = '';
    }
}

genderTabsList.forEach(tab => {
    tab.addEventListener('click', (e) => {
        genderTabsList.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedGender = tab.dataset.gender;

        if (selectedGender === 'male') {
            maleCategoriesDiv.style.display = 'block';
        } else {
            maleCategoriesDiv.style.display = 'none';
        }
        updateAadhaarVisibility();
        resultsContainer.classList.remove('active');
    });
});

categoryTabsList.forEach(tab => {
    tab.addEventListener('click', (e) => {
        categoryTabsList.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedCategory = tab.dataset.cat;
        updateAadhaarVisibility();
        resultsContainer.classList.remove('active');
    });
});

// History Tab Logic
const navBook = document.getElementById('nav-book');
const navHistory = document.getElementById('nav-history');
const bookingSection = document.getElementById('booking-section');
const historySection = document.getElementById('history-section');
const ticketHistoryList = document.getElementById('ticket-history-list');
const mainTitle = document.getElementById('main-title');
const mainSubtitle = document.getElementById('main-subtitle');

if(navBook && navHistory) {
    navBook.addEventListener('click', (e) => {
        e.preventDefault();
        navBook.classList.add('active');
        navHistory.classList.remove('active');
        bookingSection.style.display = 'block';
        historySection.style.display = 'none';
        mainTitle.innerHTML = 'Smart <span>Commute</span>, Digital <span>Tickets</span>';
        mainSubtitle.innerText = 'Smart Mobility Begins with Smart Tickets';
    });

    navHistory.addEventListener('click', (e) => {
        e.preventDefault();
        navHistory.classList.add('active');
        navBook.classList.remove('active');
        bookingSection.style.display = 'none';
        historySection.style.display = 'block';
        mainTitle.innerHTML = 'My <span>Tickets</span>';
        mainSubtitle.innerText = 'Your recent journeys';
        renderHistory();
    });
}

function renderHistory() {
    let history = JSON.parse(localStorage.getItem('bmtc_ticket_history') || '[]');
    if(history.length === 0) {
        ticketHistoryList.innerHTML = '<p style="text-align:center; color:var(--text-secondary); margin-top:2rem;">No tickets found.</p>';
        return;
    }

    ticketHistoryList.innerHTML = history.map(t => `
        <div class="ticket-card" style="margin-bottom: 20px; transform: none; opacity: 1;">
            <div class="ticket-info">
                <div class="route-badges">
                    <span class="badge" style="background: rgba(255, 255, 255, 0.1); color: var(--text-secondary);"><i class='bx bx-history'></i> Past Ticket</span>
                </div>
                <div class="journey">
                    <div class="point">
                        <h3>${t.from}</h3>
                    </div>
                    <div class="bus-icon-wrapper">
                        <div class="bus-route-line"></div>
                        <div class="bus-icon"><i class='bx bxs-bus'></i></div>
                    </div>
                    <div class="point end">
                        <h3>${t.to}</h3>
                    </div>
                </div>
                <div class="ticket-details">
                    <div class="detail-item">
                        <p>Date</p>
                        <h4>${t.date}</h4>
                    </div>
                    <div class="detail-item">
                        <p>Passengers</p>
                        <h4>${t.passenger}</h4>
                    </div>
                    <div class="detail-item">
                        <p>Total Fare</p>
                        <h4 class="price">${t.price}</h4>
                    </div>
                </div>
                <div style="margin-top: 15px; text-align: center; border-top: 1px dashed rgba(255,255,255,0.2); padding-top: 10px;">
                    <p style="color: var(--text-secondary); font-size: 0.8rem;">Ticket ID: ${t.id}</p>
                </div>
            </div>
        </div>
    `).join('');
}
