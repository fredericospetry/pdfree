pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

let pdfDoc = null,
    pageNum = 1,
    scale = 1.0,
    canvas = document.createElement('canvas'),
    ctx = canvas.getContext('2d'),
    thumbnails = [],
    selectedThumbnails = [],
    selectedExtractThumbnails = [],
    currentMode = null;

const pdfViewer = document.getElementById('pdf-viewer'),
    pageCountEl = document.getElementById('page-count'),
    pageJumpLabelEl = document.getElementById('page-jump-label'),
    pageJumpSeparatorEl = document.getElementById('page-jump-separator'),
    pageJumpSuffixEl = document.getElementById('page-jump-suffix'),
    pageNumEl = document.getElementById('page-num'),
    firstPageBtn = document.getElementById('first-page'),
    prevPageBtn = document.getElementById('prev-button'),
    nextPageBtn = document.getElementById('next-button'),
    lastPageBtn = document.getElementById('last-page'),
    loadPdfBtn = document.getElementById('load-pdf'),
    pdfInput = document.getElementById('pdf-input'),
    addPagesBtn = document.getElementById('add-pages'),
    reorderPagesBtn = document.getElementById('reorder-pages'),
    removePagesBtn = document.getElementById('remove-pages'),
    extractPagesBtn = document.getElementById('extract-pages'),
    ocrModeSelect = document.getElementById('ocr-mode'),
    savePdfBtn = document.getElementById('save-pdf'),
    addPagesArea = document.getElementById('add-pages-area'),
    addPdfInput = document.getElementById('add-pdf-input'),
    reorderArea = document.getElementById('reorder-area'),
    removeArea = document.getElementById('remove-area'),
    extractArea = document.getElementById('extract-area'),
    confirmRemoveBtn = document.getElementById('confirm-remove'),
    confirmExtractBtn = document.getElementById('confirm-extract'),
    confirmModal = document.getElementById('confirm-modal'),
    modalCancelBtn = document.getElementById('modal-cancel'),
    modalConfirmBtn = document.getElementById('modal-confirm'),
    modalMessage = document.getElementById('modal-message'),
    addedPagesNotice = document.getElementById('added-pages-notice'),
    noFilesChosen = document.getElementById('no-files-chosen'),
    addPagesThumbnails = document.getElementById('add-pages-thumbnails'),
    zoomCanvas = document.getElementById('zoom-canvas'),
    zoomCtx = zoomCanvas.getContext('2d'),
    zoomModal = document.getElementById('zoom-modal'),
    reorderThumbnailWrapper = document.querySelector('#reorder-area .thumbnail-wrapper'),
    removeThumbnailWrapper = document.querySelector('#remove-area .thumbnail-wrapper'),
    extractThumbnailWrapper = document.querySelector('#extract-area .thumbnail-wrapper'),
    confirmReorderBtn = document.getElementById('confirm-reorder'),
    progressContainer = document.getElementById('progress-container'),
    progressFill = document.getElementById('progress-fill'),
    progressText = document.getElementById('progress-text'),
    togglePdfBtn = document.getElementById('toggle-pdf'),
    pdfContainer = document.getElementById('pdf-container');

initializeApp();

function initializeApp() {
    pdfViewer.style.display = 'block';
    pdfViewer.appendChild(canvas);
    applyResponsiveButtonLabels();
    attachEventListeners();
}

function isMobileViewport() {
    return window.matchMedia('(max-width: 480px)').matches;
}

function applyResponsiveButtonLabels() {
    const mobile = isMobileViewport();

    loadPdfBtn.textContent = mobile ? 'Abrir' : 'Abrir PDF';
    removePagesBtn.textContent = mobile ? 'Remover' : 'Remover Págs';
    extractPagesBtn.textContent = mobile ? 'Extrair' : 'Extrair Págs';
    addPagesBtn.textContent = mobile ? 'Adicionar' : 'Adicionar Págs';
    reorderPagesBtn.textContent = mobile ? 'Reorganizar' : 'Reorganizar Págs';
    savePdfBtn.textContent = mobile ? 'Baixar PDF' : 'Baixar PDF Alterado';
    firstPageBtn.textContent = mobile ? '1ª' : 'Primeira';
    lastPageBtn.textContent = mobile ? 'Últ.' : 'Última';
    pageJumpLabelEl.textContent = mobile ? 'Pág:' : 'Ir para pág:';
    pageJumpSeparatorEl.textContent = mobile ? '/' : '/ de';
    pageJumpSuffixEl.textContent = mobile ? '' : 'págs.';

    const toggleHidden = pdfContainer.classList.contains('hidden');
    if (mobile) {
        togglePdfBtn.textContent = toggleHidden ? 'Mostrar' : 'Esconder';
    } else {
        togglePdfBtn.textContent = toggleHidden ? 'Mostrar PDF' : 'Esconder PDF';
    }
}

function attachEventListeners() {
    loadPdfBtn.addEventListener('click', handleOpenPdfClick);
    pdfInput.addEventListener('change', loadPDF);
    window.addEventListener('resize', applyResponsiveButtonLabels);

    firstPageBtn.addEventListener('click', () => {
        if (pageNum !== 1) {
            pageNum = 1;
            renderPage(pageNum);
        }
    });

    prevPageBtn.addEventListener('click', () => {
        if (pageNum > 1) {
            pageNum--;
            renderPage(pageNum);
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (pageNum < pdfDoc.numPages) {
            pageNum++;
            renderPage(pageNum);
        }
    });

    lastPageBtn.addEventListener('click', () => {
        if (pageNum !== pdfDoc.numPages) {
            pageNum = pdfDoc.numPages;
            renderPage(pageNum);
        }
    });

    togglePdfBtn.addEventListener('click', () => {
        const isHidden = pdfContainer.classList.toggle('hidden');
        if (isMobileViewport()) {
            togglePdfBtn.textContent = isHidden ? 'Mostrar' : 'Esconder';
        } else {
            togglePdfBtn.textContent = isHidden ? 'Mostrar PDF' : 'Esconder PDF';
        }
        togglePdfBtn.classList.toggle('active', isHidden);
    });

    pageNumEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const newPageNum = parseInt(pageNumEl.value);
            if (newPageNum > 0 && newPageNum <= pdfDoc.numPages) {
                pageNum = newPageNum;
                renderPage(pageNum);
            } else {
                pageNumEl.value = pageNum;
            }
        }
    });

    addPagesBtn.addEventListener('click', toggleAddPagesMode);
    reorderPagesBtn.addEventListener('click', toggleReorderMode);
    removePagesBtn.addEventListener('click', toggleRemoveMode);
    extractPagesBtn.addEventListener('click', toggleExtractMode);
    ocrModeSelect.addEventListener('change', handleOcrAction);
    savePdfBtn.addEventListener('click', confirmSave);

    addPdfInput.addEventListener('change', function (e) {
        if (this.files.length > 0) {
            noFilesChosen.textContent = `${this.files.length} arquivo(s) selecionado(s)`;
            handleAddPdfFiles(e);
        } else {
            noFilesChosen.textContent = 'Nenhum arquivo escolhido';
        }
    });

    pdfViewer.addEventListener('click', showZoomModal);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        addPagesArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        addPagesArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        addPagesArea.addEventListener(eventName, unhighlight, false);
    });

    addPagesArea.addEventListener('drop', handleDrop, false);

    confirmRemoveBtn.addEventListener('click', removeSelectedPages);
    confirmExtractBtn.addEventListener('click', handleExtractClick);
    modalCancelBtn.addEventListener('click', () => {
        confirmModal.style.display = 'none';
    });
}

function handleOpenPdfClick() {
    if (pdfDoc) {
        modalMessage.textContent = 'Você tem um PDF sendo manipulado. Deseja abrir um novo PDF? Todas as alterações não salvas serão perdidas.';
        modalConfirmBtn.onclick = function () {
            pdfInput.click();
            confirmModal.style.display = 'none';
        };
        modalCancelBtn.onclick = function () {
            confirmModal.style.display = 'none';
        };
        confirmModal.style.display = 'flex';
    } else {
        pdfInput.click();
    }
}

async function handleOcrAction() {
    const selectedMode = ocrModeSelect.value;
    if (!selectedMode) return;

    try {
        if (selectedMode === 'all') {
            await handleOcrAllPages();
            return;
        }

        await handleOcrCurrentPage();
    } finally {
        ocrModeSelect.value = '';
    }
}

async function handleExtractClick() {
    if (selectedExtractThumbnails.length === 0) return;

    try {
        modalMessage.textContent = `Tem certeza que deseja extrair ${selectedExtractThumbnails.length} página(s) para um novo PDF? O download iniciará ao confirmar.`;
        modalConfirmBtn.onclick = async function () {
            try {
                const originalPdfBytes = await pdfInput.files[0].arrayBuffer();
                const originalPdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);

                const newPdfDoc = await PDFLib.PDFDocument.create();
                const pagesToExtract = [...selectedExtractThumbnails].sort((a, b) => a - b);
                const pageIndices = pagesToExtract.map(num => num - 1);

                if (pageIndices.some(index => index < 0 || index >= originalPdfDoc.getPageCount())) {
                    throw new Error('Índices de página inválidos');
                }

                const pages = await newPdfDoc.copyPages(originalPdfDoc, pageIndices);
                pages.forEach(page => newPdfDoc.addPage(page));

                const newPdfBytes = await newPdfDoc.save();
                const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = 'paginas_extraidas.pdf';

                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                selectedExtractThumbnails = [];
                confirmExtractBtn.style.display = 'none';

                extractArea.style.display = 'flex';
                setModeButtonState('extract');
                createThumbnails();

            } catch (error) {
                console.error('Erro ao extrair páginas:', error);
                alert('Ocorreu um erro ao extrair as páginas. Por favor, tente novamente.');
            }
            confirmModal.style.display = 'none';
        };

        confirmModal.style.display = 'flex';
    } catch (error) {
        console.error('Erro ao preparar extração de páginas:', error);
        alert('Ocorreu um erro ao preparar a extração das páginas. Por favor, tente novamente.');
    }
}

async function handleOcrCurrentPage() {
    if (!pdfDoc) {
        alert('Para usar OCR, primeiro abra um PDF no botão "Abrir PDF".');
        return;
    }

    if (typeof Tesseract === 'undefined') {
        alert('Biblioteca OCR não encontrada. Recarregue a página e tente novamente.');
        return;
    }

    const ocrCanvas = document.createElement('canvas');

    try {
        showProgress('Iniciando OCR...');

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        ocrCanvas.width = viewport.width;
        ocrCanvas.height = viewport.height;

        const ocrContext = ocrCanvas.getContext('2d');
        await page.render({ canvasContext: ocrContext, viewport }).promise;

        const result = await Tesseract.recognize(ocrCanvas, 'por+eng', {
            logger: (message) => {
                if (!message || !message.status) return;

                const statusText = `OCR: ${message.status}`;
                if (typeof message.progress === 'number') {
                    const progressValue = Math.round(message.progress * 100);
                    progressFill.style.width = `${progressValue}%`;
                    progressText.textContent = `${statusText} ${progressValue}%`;
                    return;
                }

                progressText.textContent = statusText;
            }
        });

        const extractedText = (result?.data?.text || '').trim();

        const textBlob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
        const textUrl = URL.createObjectURL(textBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = textUrl;
        downloadLink.download = `ocr_pagina_${pageNum}.txt`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(textUrl);

        if (!extractedText) {
            alert('OCR concluído, mas nenhum texto foi identificado na página atual.');
        }

        hideProgress(200);
    } catch (error) {
        console.error('Erro ao executar OCR:', error);
        alert('Ocorreu um erro ao executar OCR. Por favor, tente novamente.');
        hideProgress();
    } finally {
        ocrCanvas.width = 1;
        ocrCanvas.height = 1;
    }
}

async function handleOcrAllPages() {
    if (!pdfDoc) {
        alert('Para usar OCR, primeiro abra um PDF no botão "Abrir PDF".');
        return;
    }

    if (typeof Tesseract === 'undefined') {
        alert('Biblioteca OCR não encontrada. Recarregue a página e tente novamente.');
        return;
    }

    const totalPages = pdfDoc.numPages;
    const allText = [];
    const ocrCanvas = document.createElement('canvas');

    try {
        showProgress('Iniciando OCR em todas as páginas...');

        for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
            const page = await pdfDoc.getPage(currentPage);
            const viewport = page.getViewport({ scale: 2.0 });
            ocrCanvas.width = viewport.width;
            ocrCanvas.height = viewport.height;

            const ocrContext = ocrCanvas.getContext('2d');
            await page.render({ canvasContext: ocrContext, viewport }).promise;

            const result = await Tesseract.recognize(ocrCanvas, 'por+eng', {
                logger: (message) => {
                    if (!message || typeof message.progress !== 'number') {
                        progressText.textContent = `OCR página ${currentPage}/${totalPages}...`;
                        return;
                    }

                    const pageProgress = message.progress;
                    const globalProgress = ((currentPage - 1) + pageProgress) / totalPages;
                    const progressValue = Math.round(globalProgress * 100);
                    progressFill.style.width = `${progressValue}%`;
                    progressText.textContent = `OCR página ${currentPage}/${totalPages} - ${progressValue}%`;
                }
            });

            const extractedText = (result?.data?.text || '').trim();
            allText.push(`===== Página ${currentPage} =====\n${extractedText}\n`);
        }

        const mergedText = allText.join('\n');
        const textBlob = new Blob([mergedText], { type: 'text/plain;charset=utf-8' });
        const textUrl = URL.createObjectURL(textBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = textUrl;
        downloadLink.download = 'ocr_todas_as_paginas.txt';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(textUrl);

        if (!mergedText.replace(/\s+/g, '')) {
            alert('OCR concluído, mas nenhum texto foi identificado nas páginas.');
        }

        hideProgress(200);
    } catch (error) {
        console.error('Erro ao executar OCR em todas as páginas:', error);
        alert('Ocorreu um erro ao executar OCR em todas as páginas. Por favor, tente novamente.');
        hideProgress();
    } finally {
        ocrCanvas.width = 1;
        ocrCanvas.height = 1;
    }
}

function showZoomModal() {
    if (!pdfDoc) return;

    zoomModal.style.display = 'flex';
    renderZoomPage(pageNum);

    const tooltip = document.createElement('div');
    tooltip.style.position = 'fixed';
    tooltip.style.backgroundColor = 'rgba(0,0,0,0.7)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '5px 10px';
    tooltip.style.borderRadius = '3px';
    tooltip.style.fontSize = '12px';
    tooltip.style.pointerEvents = 'none';
    tooltip.textContent = 'Clique para fechar';
    document.body.appendChild(tooltip);

    zoomModal.onmousemove = (e) => {
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
    };

    zoomModal.onmouseleave = () => {
        tooltip.style.display = 'none';
    };

    zoomModal.onmouseenter = () => {
        tooltip.style.display = 'block';
    };

    zoomModal.onclick = () => {
        zoomModal.style.display = 'none';
        if (tooltip.parentNode) {
            document.body.removeChild(tooltip);
        }
        zoomModal.onmousemove = null;
        zoomModal.onmouseleave = null;
        zoomModal.onmouseenter = null;
        zoomModal.onclick = null;
    };
}

function renderZoomPage(num) {
    pdfDoc.getPage(num).then(function (page) {
        const viewport = page.getViewport({ scale: 1.5 });
        zoomCanvas.height = viewport.height;
        zoomCanvas.width = viewport.width;

        const renderContext = {
            canvasContext: zoomCtx,
            viewport: viewport
        };

        page.render(renderContext);
    });
}

function showProgress(message = 'Atualizando PDF...') {
    progressContainer.classList.add('active');
    progressFill.style.width = '0%';
    progressText.textContent = message;
}

function hideProgress(delay = 0) {
    const reset = () => {
        progressContainer.classList.remove('active');
        progressFill.style.width = '0%';
        progressText.textContent = 'Atualizando PDF...';
    };

    if (delay > 0) {
        setTimeout(reset, delay);
        return;
    }

    reset();
}

function updateProgress(current, total, label = 'Atualizando PDF...') {
    if (!total) return;

    if (current !== total && current % 4 !== 0) {
        return;
    }

    const progress = (current / total) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${label} ${Math.round(progress)}%`;
}

function setModeButtonState(activeMode = null) {
    const modeButtons = {
        add: addPagesBtn,
        reorder: reorderPagesBtn,
        remove: removePagesBtn,
        extract: extractPagesBtn
    };

    Object.values(modeButtons).forEach(button => {
        button.classList.remove('active');
        button.style.backgroundColor = '';
    });

    if (activeMode && modeButtons[activeMode]) {
        modeButtons[activeMode].classList.add('active');
        modeButtons[activeMode].style.backgroundColor = '#4d5157';
    }
}

async function mapWithConcurrency(totalItems, worker, concurrency = 3) {
    const results = new Array(totalItems);
    let currentIndex = 0;

    async function runWorker() {
        while (true) {
            const index = currentIndex++;
            if (index >= totalItems) break;
            results[index] = await worker(index);
        }
    }

    const workerCount = Math.min(concurrency, totalItems);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
}

function setPdfInputFile(file) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    pdfInput.files = dataTransfer.files;
}

async function loadPdfFromFile(file, options = {}) {
    if (!file) return;

    const { showViewer = false } = options;
    const typedarray = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument(typedarray).promise;

    pdfDoc = pdf;
    pageCountEl.textContent = pdf.numPages;
    pageNum = 1;
    pageNumEl.value = pageNum;

    updateNavButtons();
    savePdfBtn.disabled = false;
    ocrModeSelect.disabled = false;
    ocrModeSelect.value = '';

    if (showViewer) {
        pdfViewer.style.display = 'block';
    }

    renderPage(pageNum);
}

async function loadPDF(e) {
    const file = e.target.files[0];
    if (!file) return;

    await loadPdfFromFile(file, { showViewer: true });
    await createThumbnails();

    resetModes();
}

function renderPage(num) {
    pdfDoc.getPage(num).then(function (page) {
        const viewport = page.getViewport({ scale: scale * 0.7 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        page.render(renderContext);
    });

    pageNumEl.value = num;
    updateNavButtons();
}

function updateNavButtons() {
    firstPageBtn.disabled = pageNum === 1;
    prevPageBtn.disabled = pageNum === 1;
    nextPageBtn.disabled = pageNum === pdfDoc.numPages;
    lastPageBtn.disabled = pageNum === pdfDoc.numPages;
}

async function createThumbnails() {
    reorderThumbnailWrapper.innerHTML = '';
    removeThumbnailWrapper.innerHTML = '';
    extractThumbnailWrapper.innerHTML = '';
    thumbnails = [];

    try {
        showProgress();

        thumbnails = await mapWithConcurrency(pdfDoc.numPages, async (i) => {
            const pageNum = i + 1;
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.2 });
            const thumbnailCanvas = document.createElement('canvas');
            thumbnailCanvas.width = viewport.width;
            thumbnailCanvas.height = viewport.height;

            const thumbnailCtx = thumbnailCanvas.getContext('2d');
            await page.render({ canvasContext: thumbnailCtx, viewport }).promise;

            const thumbnail = document.createElement('div');
            thumbnail.className = 'thumbnail';
            thumbnail.dataset.pageNum = pageNum;
            thumbnail.draggable = true;

            const img = document.createElement('img');
            img.src = thumbnailCanvas.toDataURL();

            const pageNumber = document.createElement('div');
            pageNumber.className = 'page-number';
            pageNumber.textContent = `Página ${pageNum}`;

            thumbnail.appendChild(img);
            thumbnail.appendChild(pageNumber);

            thumbnailCanvas.width = 1;
            thumbnailCanvas.height = 1;

            updateProgress(i + 1, pdfDoc.numPages);

            return { element: thumbnail, pageNum };
        });

        if (currentMode) {
            renderModeThumbnails(currentMode);
        }

        hideProgress(500);

    } catch (error) {
        console.error('Erro ao criar miniaturas:', error);
        hideProgress();
    }
}

function bindSelectionBehavior(element, mode) {
    element.addEventListener('click', function (e) {
        e.stopPropagation();
        const isExtract = mode === 'extract';
        const selectedClass = isExtract ? 'selected-extract' : 'selected';
        const selectedList = isExtract ? selectedExtractThumbnails : selectedThumbnails;
        const confirmButton = isExtract ? confirmExtractBtn : confirmRemoveBtn;

        this.classList.toggle(selectedClass);

        const pageNum = parseInt(this.dataset.pageNum);
        const index = selectedList.indexOf(pageNum);

        if (index === -1) selectedList.push(pageNum);
        else selectedList.splice(index, 1);

        confirmButton.style.display = selectedList.length > 0 ? 'block' : 'none';
    });
}

function renderModeThumbnails(mode) {
    if (!thumbnails.length) return;

    if (mode === 'reorder') {
        reorderThumbnailWrapper.innerHTML = '';
        const fragment = document.createDocumentFragment();
        thumbnails.forEach(thumb => {
            const clone = thumb.element.cloneNode(true);
            setupDragAndDrop(clone);
            fragment.appendChild(clone);
        });
        reorderThumbnailWrapper.appendChild(fragment);
        return;
    }

    const isRemove = mode === 'remove';
    const wrapper = isRemove ? removeThumbnailWrapper : extractThumbnailWrapper;

    wrapper.innerHTML = '';
    const fragment = document.createDocumentFragment();
    thumbnails.forEach(thumb => {
        const clone = thumb.element.cloneNode(true);
        bindSelectionBehavior(clone, mode);
        fragment.appendChild(clone);
    });
    wrapper.appendChild(fragment);
}

async function openMode(mode) {
    const configs = {
        reorder: {
            area: reorderArea,
            button: reorderPagesBtn,
            alertMessage: 'Para reorganizar páginas, primeiro abra um PDF no botão "Abrir PDF".',
            onClose: () => {
                confirmReorderBtn.style.display = 'none';
            }
        },
        remove: {
            area: removeArea,
            button: removePagesBtn,
            alertMessage: 'Para remover páginas, primeiro abra um PDF no botão "Abrir PDF".',
            onClose: () => {
                selectedThumbnails = [];
                confirmRemoveBtn.style.display = 'none';
            }
        },
        extract: {
            area: extractArea,
            button: extractPagesBtn,
            alertMessage: 'Para extrair páginas, primeiro abra um PDF no botão "Abrir PDF".',
            onClose: () => {
                selectedExtractThumbnails = [];
                confirmExtractBtn.style.display = 'none';
            }
        }
    };

    const config = configs[mode];

    if (!pdfDoc) {
        alert(config.alertMessage);
        return;
    }

    if (currentMode === mode) {
        currentMode = null;
        config.area.style.display = 'none';
        setModeButtonState(null);
        if (config.onClose) config.onClose();
        return;
    }

    resetModes();
    currentMode = mode;
    config.area.style.display = 'flex';
    setModeButtonState(mode);

    if (!thumbnails.length) {
        await createThumbnails();
    }

    renderModeThumbnails(mode);
}

function toggleReorderMode() {
    openMode('reorder');
}

function toggleRemoveMode() {
    openMode('remove');
}

function toggleExtractMode() {
    openMode('extract');
}

function resetModes() {
    currentMode = null;

    addPagesArea.style.display = 'none';
    reorderArea.style.display = 'none';
    removeArea.style.display = 'none';
    extractArea.style.display = 'none';

    setModeButtonState(null);

    selectedThumbnails = [];
    selectedExtractThumbnails = [];

    if (confirmRemoveBtn) confirmRemoveBtn.style.display = 'none';
    if (confirmExtractBtn) confirmExtractBtn.style.display = 'none';
    if (confirmReorderBtn) confirmReorderBtn.style.display = 'none';

    noFilesChosen.textContent = 'Nenhum arquivo escolhido';
    addedPagesNotice.style.display = 'none';
    addPagesThumbnails.innerHTML = '';
}

function handleAddPdfFiles(e) {
    const files = e.target.files;
    if (files.length === 0) return;

    processPdfFiles(files);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        noFilesChosen.textContent = `${files.length} arquivo(s) selecionado(s)`;
        processPdfFiles(files);
    }
}

async function processPdfFiles(files) {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
        alert('Por favor, selecione apenas arquivos PDF.');
        return;
    }

    if (!pdfDoc) {
        alert('Para adicionar arquivos PDF\'s, primeiro abra um deles no botão "Abrir PDF".');
        return;
    }

    addedPagesNotice.style.display = 'block';
    noFilesChosen.style.display = 'none';
    addPagesThumbnails.innerHTML = '';

    try {
        showProgress();

        let totalPagesToAdd = 0;
        let allThumbnails = [];

        const originalPdfBytes = await pdfInput.files[0].arrayBuffer();
        const originalPdfDoc = await pdfjsLib.getDocument(originalPdfBytes).promise;

        const existingThumbnails = await Promise.all(
            Array.from({ length: originalPdfDoc.numPages }, async (_, i) => {
                const thumbnail = await createAddPageThumbnail(originalPdfDoc, i + 1, 'PDF Atual');
                updateProgress(i + 1, originalPdfDoc.numPages);
                return thumbnail;
            })
        );

        allThumbnails = allThumbnails.concat(existingThumbnails);

        for (const file of pdfFiles) {
            const newPdfBytes = await file.arrayBuffer();
            const newPdfDoc = await pdfjsLib.getDocument(newPdfBytes).promise;

            totalPagesToAdd += newPdfDoc.numPages;

            const thumbnails = await Promise.all(
                Array.from({ length: newPdfDoc.numPages }, async (_, i) => {
                    const thumbnail = await createAddPageThumbnail(newPdfDoc, i + 1, file.name);
                    updateProgress(i + 1, newPdfDoc.numPages);
                    return thumbnail;
                })
            );

            allThumbnails = allThumbnails.concat(thumbnails);
        }

        addPagesThumbnails.append(...allThumbnails.filter(Boolean));

        addedPagesNotice.textContent = `${totalPagesToAdd} página(s) inserida(s) após a última página. Prossiga para a próxima etapa!`;

        const originalPdfDocLib = await PDFLib.PDFDocument.load(originalPdfBytes);

        for (const file of pdfFiles) {
            const newPdfBytes = await file.arrayBuffer();
            const newPdfDoc = await PDFLib.PDFDocument.load(newPdfBytes);

            const pages = await originalPdfDocLib.copyPages(newPdfDoc, newPdfDoc.getPageIndices());
            pages.forEach(page => originalPdfDocLib.addPage(page));
        }

        const mergedPdfBytes = await originalPdfDocLib.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

        const newFile = new File([blob], 'merged.pdf', { type: 'application/pdf' });
        setPdfInputFile(newFile);
        await loadPdfFromFile(newFile);
        await createThumbnails();

        addPagesArea.style.display = 'block';
        setModeButtonState('add');

        hideProgress(500);

    } catch (error) {
        console.error('Erro ao processar PDFs:', error);
        alert('Ocorreu um erro ao processar os PDFs. Por favor, tente novamente.');
        hideProgress();
    }
}

async function createAddPageThumbnail(pdfDoc, pageNum, filename) {
    try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.15 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;

        const thumbnail = document.createElement('div');
        thumbnail.className = 'thumbnail';
        thumbnail.style.position = 'relative';

        const img = document.createElement('img');
        img.src = canvas.toDataURL();
        img.style.border = '1px solid var(--deepseek-border)';

        const info = document.createElement('div');
        info.style.position = 'absolute';
        info.style.bottom = '0';
        info.style.left = '0';
        info.style.right = '0';
        info.style.backgroundColor = 'rgba(0,0,0,0.7)';
        info.style.color = 'white';
        info.style.padding = '2px';
        info.style.fontSize = '10px';
        info.style.textAlign = 'center';
        info.textContent = `Pág. ${pageNum}`;

        if (pageNum === 1) {
            const fileNameText = document.createElement('div');
            fileNameText.style.fontSize = '9px';
            fileNameText.style.marginBottom = '2px';
            fileNameText.textContent = filename.length > 15 ?
                filename.substring(0, 12) + '...' : filename;
            thumbnail.insertBefore(fileNameText, thumbnail.firstChild);
        }

        thumbnail.appendChild(img);
        thumbnail.appendChild(info);

        canvas.width = 1;
        canvas.height = 1;

        return thumbnail;
    } catch (error) {
        console.error('Erro ao criar miniatura:', error);
        return null;
    }
}

async function removeSelectedPages() {
    if (selectedThumbnails.length === 0) return;

    try {
        modalMessage.textContent = `Tem certeza que deseja remover ${selectedThumbnails.length} página(s)?`;
        modalConfirmBtn.onclick = async function () {
            try {
                showProgress('Removendo páginas...');

                const originalPdfBytes = await pdfInput.files[0].arrayBuffer();
                const originalPdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);

                const newPdfDoc = await PDFLib.PDFDocument.create();
                const pagesToRemove = [...selectedThumbnails].sort((a, b) => b - a);

                const pageIndices = Array.from({ length: originalPdfDoc.getPageCount() }, (_, i) => i)
                    .filter(i => !pagesToRemove.includes(i + 1));

                if (pageIndices.length === 0) {
                    alert('Não é possível remover todas as páginas do PDF.');
                    return;
                }

                const pages = await newPdfDoc.copyPages(originalPdfDoc, pageIndices);
                pages.forEach(page => newPdfDoc.addPage(page));

                const newPdfBytes = await newPdfDoc.save();
                const blob = new Blob([newPdfBytes], { type: 'application/pdf' });

                const newFile = new File([blob], 'removed_pages.pdf', { type: 'application/pdf' });
                setPdfInputFile(newFile);
                await loadPdfFromFile(newFile);

                progressText.textContent = 'Criando novas miniaturas...';
                progressFill.style.width = '0%';

                await createThumbnails();
                selectedThumbnails = [];
                confirmRemoveBtn.style.display = 'none';

                removeArea.style.display = 'flex';
                setModeButtonState('remove');

                hideProgress(500);

            } catch (error) {
                console.error('Erro ao remover páginas:', error);
                alert('Ocorreu um erro ao remover as páginas. Por favor, tente novamente.');
                hideProgress();
            }
            confirmModal.style.display = 'none';
        };

        confirmModal.style.display = 'flex';
    } catch (error) {
        console.error('Erro ao preparar remoção de páginas:', error);
        alert('Ocorreu um erro ao preparar a remoção das páginas. Por favor, tente novamente.');
    }
}

function confirmSave() {
    if (!pdfDoc) return;

    modalMessage.textContent = 'Tem certeza que deseja baixar o PDF com as alterações?';
    modalConfirmBtn.onclick = function () {
        downloadPdf();
        confirmModal.style.display = 'none';
    };

    confirmModal.style.display = 'flex';
}

async function downloadPdf() {
    try {
        const pdfBytes = await pdfInput.files[0].arrayBuffer();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited_document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Erro ao baixar o PDF:', error);
        alert('Ocorreu um erro ao baixar o PDF. Por favor, tente novamente.');
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    addPagesArea.classList.add('highlight');
}

function unhighlight() {
    addPagesArea.classList.remove('highlight');
}

async function saveReorderedPdf() {
    try {
        showProgress();

        const originalPdfBytes = await pdfInput.files[0].arrayBuffer();
        const originalPdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);

        const newPdfDoc = await PDFLib.PDFDocument.create();

        const newOrder = Array.from(reorderThumbnailWrapper.querySelectorAll('.thumbnail'))
            .map(thumb => parseInt(thumb.dataset.pageNum) - 1);

        const pages = await newPdfDoc.copyPages(originalPdfDoc, newOrder);
        pages.forEach(page => newPdfDoc.addPage(page));

        const newPdfBytes = await newPdfDoc.save();
        const blob = new Blob([newPdfBytes], { type: 'application/pdf' });

        const newFile = new File([blob], 'reordered.pdf', { type: 'application/pdf' });
        setPdfInputFile(newFile);
        await loadPdfFromFile(newFile);
        await createThumbnails();

        reorderArea.style.display = 'flex';
        confirmReorderBtn.style.display = 'none';
        setModeButtonState('reorder');
        renderModeThumbnails('reorder');

    } catch (error) {
        console.error('Erro ao reordenar páginas:', error);
        alert('Ocorreu um erro ao reordenar as páginas. Por favor, tente novamente.');
        hideProgress();
    }
}

confirmReorderBtn.addEventListener('click', function () {
    modalMessage.textContent = 'Tem certeza que deseja salvar a nova ordem das páginas?';
    modalConfirmBtn.onclick = function () {
        saveReorderedPdf();
        confirmModal.style.display = 'none';
    };
    confirmModal.style.display = 'flex';
});

function setupDragAndDrop(element) {
    element.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', this.dataset.pageNum);
        setTimeout(() => this.classList.add('dragging'), 0);
    });

    element.addEventListener('dragend', function () {
        this.classList.remove('dragging');
        confirmReorderBtn.style.display = 'block';
    });

    element.addEventListener('dragover', function (e) {
        e.preventDefault();
        const draggingElement = document.querySelector('.dragging');
        if (draggingElement && draggingElement !== this) {
            const rect = this.getBoundingClientRect();
            const next = (e.clientY - rect.top) > (rect.height / 2);

            if (next) {
                reorderThumbnailWrapper.insertBefore(draggingElement, this.nextSibling);
            } else {
                reorderThumbnailWrapper.insertBefore(draggingElement, this);
            }
        }
    });
}

function toggleAddPagesMode() {
    if (!pdfDoc) {
        alert('Para adicionar arquivos PDF\'s, primeiro abra um deles no botão "Abrir PDF".');
        return;
    }

    if (currentMode === 'add') {
        currentMode = null;
        addPagesArea.style.display = 'none';
        setModeButtonState(null);
    } else {
        resetModes();
        currentMode = 'add';
        setModeButtonState('add');
        addPagesArea.style.display = 'block';
        addPdfInput.click();
    }
}
