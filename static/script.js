document.addEventListener('DOMContentLoaded', () => {
    // ── TABS ──
    const tabs = document.querySelectorAll('.tab');
    const panes = document.querySelectorAll('.tab-pane');
    const indicator = document.querySelector('.tab-indicator');

    function updateTabs(activeTab) {
        tabs.forEach(t => t.classList.remove('active'));
        activeTab.classList.add('active');
        
        // Move indicator
        indicator.style.width = activeTab.offsetWidth + 'px';
        indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;

        // Show pane
        const targetId = 'pane-' + activeTab.dataset.tab;
        panes.forEach(p => {
            if(p.id === targetId) p.classList.add('active', 'hidden');
            else p.classList.remove('active');
        });
        
        // Stop camera if leaving camera tab
        if (activeTab.dataset.tab !== 'camera') {
            stopCamera();
        }
        
        setTimeout(() => {
            document.getElementById(targetId).classList.remove('hidden');
        }, 10);
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => updateTabs(tab));
    });
    // Init indicator
    window.addEventListener('resize', () => updateTabs(document.querySelector('.tab.active')));
    setTimeout(() => updateTabs(document.querySelector('.tab.active')), 100);

    // ── COMMON ──
    function showToast(message, type = 'info') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%) translateY(20px)',
            background: type === 'error' ? '#ff5b5b22' : '#4f8dff22',
            color: type === 'error' ? '#ff8080' : '#a0c4ff',
            border: `1px solid ${type === 'error' ? '#ff5b5b55' : '#4f8dff55'}`,
            padding: '0.75rem 1.5rem', borderRadius: '50px', fontSize: '0.9rem', fontWeight: '500',
            zIndex: '9999', backdropFilter: 'blur(12px)', transition: 'all 0.3s ease', opacity: '0',
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
        setTimeout(() => {
            toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ── IMAGE UPLOAD ──
    const imgDropArea = document.getElementById('img-drop-area');
    const imgFileInput = document.getElementById('img-file-input');
    const imgBrowseBtn = document.getElementById('img-browse-btn');
    const imgUploadSection = document.getElementById('img-upload-section');
    const imgLoading = document.getElementById('img-loading');
    const imgResultSection = document.getElementById('img-result-section');
    const imgOriginal = document.getElementById('img-original');
    const imgResult = document.getElementById('img-result');
    const imgResetBtn = document.getElementById('img-reset-btn');

    ['dragenter','dragover','dragleave','drop'].forEach(e => imgDropArea.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
    ['dragenter','dragover'].forEach(e => imgDropArea.addEventListener(e, () => imgDropArea.classList.add('dragover')));
    ['dragleave','drop'].forEach(e => imgDropArea.addEventListener(e, () => imgDropArea.classList.remove('dragover')));
    imgDropArea.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleImgFile(e.dataTransfer.files[0]); });
    imgDropArea.addEventListener('click', () => imgFileInput.click());
    imgBrowseBtn.addEventListener('click', e => { e.stopPropagation(); imgFileInput.click(); });
    imgFileInput.addEventListener('change', () => { if (imgFileInput.files.length) handleImgFile(imgFileInput.files[0]); });
    imgResetBtn.addEventListener('click', () => {
        imgResultSection.classList.add('hidden');
        imgUploadSection.classList.remove('hidden');
        imgFileInput.value = '';
    });

    function handleImgFile(file) {
        if (!file.type.startsWith('image/')) { showToast('Please upload an image file.', 'error'); return; }
        const reader = new FileReader();
        reader.onload = e => { imgOriginal.src = e.target.result; };
        reader.readAsDataURL(file);

        imgUploadSection.classList.add('hidden');
        imgLoading.classList.remove('hidden');

        const formData = new FormData(); formData.append('image', file);
        fetch('/detect', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if (!data.success) throw new Error(data.error);
                imgLoading.classList.add('hidden');
                imgResult.src = data.result_image;
                document.getElementById('img-detection-summary').textContent = data.count === 0 ? 'No objects detected.' : `Found ${data.count} object(s).`;
                renderDetectionList(data.detections, document.getElementById('img-detection-list'), document.getElementById('img-no-detection'));
                imgResultSection.classList.remove('hidden');
            }).catch(err => {
                imgLoading.classList.add('hidden'); imgUploadSection.classList.remove('hidden');
                showToast('Error: ' + err.message, 'error');
            });
    }

    function renderDetectionList(detections, listEl, noDetEl) {
        listEl.innerHTML = '';
        if(detections.length === 0) { noDetEl.classList.remove('hidden'); return; }
        noDetEl.classList.add('hidden');
        let delay = 0;
        detections.forEach(det => {
            const li = document.createElement('li'); li.className = 'detection-item'; li.style.animationDelay = `${delay}ms`;
            const initials = det.label.substring(0, 2).toUpperCase();
            li.innerHTML = `
                <div class="detection-icon">${initials}</div>
                <div class="detection-info">
                    <div class="detection-name">${det.label}</div>
                    <div class="detection-conf">${det.confidence}% confidence</div>
                    <div class="conf-bar-wrap"><div class="conf-bar" style="width: ${det.confidence}%"></div></div>
                </div>`;
            listEl.appendChild(li); delay += 60;
        });
    }

    // ── VIDEO UPLOAD ──
    const vidDropArea = document.getElementById('vid-drop-area');
    const vidFileInput = document.getElementById('vid-file-input');
    const vidBrowseBtn = document.getElementById('vid-browse-btn');
    const vidUploadSection = document.getElementById('vid-upload-section');
    const vidLoading = document.getElementById('vid-loading');
    const vidResultSection = document.getElementById('vid-result-section');
    const vidPlayer = document.getElementById('vid-result-player');
    const vidResetBtn = document.getElementById('vid-reset-btn');

    ['dragenter','dragover','dragleave','drop'].forEach(e => vidDropArea.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
    ['dragenter','dragover'].forEach(e => vidDropArea.addEventListener(e, () => vidDropArea.classList.add('dragover')));
    ['dragleave','drop'].forEach(e => vidDropArea.addEventListener(e, () => vidDropArea.classList.remove('dragover')));
    vidDropArea.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleVidFile(e.dataTransfer.files[0]); });
    vidDropArea.addEventListener('click', () => vidFileInput.click());
    vidBrowseBtn.addEventListener('click', e => { e.stopPropagation(); vidFileInput.click(); });
    vidFileInput.addEventListener('change', () => { if (vidFileInput.files.length) handleVidFile(vidFileInput.files[0]); });
    vidResetBtn.addEventListener('click', () => {
        vidResultSection.classList.add('hidden'); vidUploadSection.classList.remove('hidden');
        vidFileInput.value = ''; vidPlayer.src = '';
    });

    function handleVidFile(file) {
        if (!file.type.startsWith('video/')) { showToast('Please upload a video file.', 'error'); return; }
        vidUploadSection.classList.add('hidden');
        vidLoading.classList.remove('hidden');

        const formData = new FormData(); formData.append('video', file);
        fetch('/detect_video', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if (!data.success) throw new Error(data.error);
                vidLoading.classList.add('hidden');
                vidPlayer.src = data.video_url + '?t=' + new Date().getTime(); // cache bust
                vidPlayer.load();
                
                document.getElementById('vid-detection-summary').textContent = `Processed ${data.frames_processed} frames.`;
                
                const listEl = document.getElementById('vid-detection-list');
                listEl.innerHTML = '';
                data.detections.forEach(det => {
                    const li = document.createElement('li'); li.className = 'detection-item';
                    const initials = det.label.substring(0, 2).toUpperCase();
                    li.innerHTML = `
                        <div class="detection-icon" style="background:var(--accent-video)">${initials}</div>
                        <div class="detection-info">
                            <div class="detection-name">${det.label}</div>
                            <div class="detection-conf">Avg. Conf: ${det.confidence}% | ${det.count} frames</div>
                            <div class="conf-bar-wrap"><div class="conf-bar" style="width: ${det.confidence}%; background: linear-gradient(90deg, var(--accent-video), #ff5b5b)"></div></div>
                        </div>`;
                    listEl.appendChild(li);
                });
                vidResultSection.classList.remove('hidden');
                vidPlayer.play();
            }).catch(err => {
                vidLoading.classList.add('hidden'); vidUploadSection.classList.remove('hidden');
                showToast('Error: ' + err.message, 'error');
            });
    }

    // ── LIVE CAMERA ──
    const camVideo = document.getElementById('cam-video');
    const camCanvas = document.getElementById('cam-capture');
    const camResult = document.getElementById('cam-result');
    const camStartBtn = document.getElementById('cam-start-btn');
    const camStopBtn = document.getElementById('cam-stop-btn');
    const camPlaceholder = document.getElementById('cam-placeholder');
    const camResultPlaceholder = document.getElementById('cam-result-placeholder');
    const camFpsBadge = document.getElementById('cam-fps-badge');
    const camLiveTags = document.getElementById('cam-detection-live');
    
    let camStream = null;
    let camInterval = null;
    let isProcessing = false;
    let frameCount = 0;
    let lastTime = Date.now();

    camStartBtn.addEventListener('click', async () => {
        try {
            camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } });
            camVideo.srcObject = camStream;
            camPlaceholder.style.display = 'none';
            camResultPlaceholder.style.display = 'none';
            camResult.style.display = 'block';
            camStartBtn.classList.add('hidden');
            camStopBtn.classList.remove('hidden');
            camFpsBadge.classList.remove('hidden');
            
            // Loop for capturing frames
            camInterval = setInterval(processFrame, 150); // Target ~6-7 FPS
        } catch (err) {
            showToast('Camera access denied or unavailable.', 'error');
        }
    });

    camStopBtn.addEventListener('click', stopCamera);

    function stopCamera() {
        if (camStream) {
            camStream.getTracks().forEach(track => track.stop());
            camStream = null;
        }
        if (camInterval) { clearInterval(camInterval); camInterval = null; }
        
        camVideo.srcObject = null;
        camPlaceholder.style.display = 'flex';
        camResultPlaceholder.style.display = 'flex';
        camResult.style.display = 'none';
        camStartBtn.classList.remove('hidden');
        camStopBtn.classList.add('hidden');
        camFpsBadge.classList.add('hidden');
        camLiveTags.innerHTML = '';
    }

    async function processFrame() {
        if (isProcessing || !camStream) return;
        isProcessing = true;

        // Calc FPS
        frameCount++;
        let now = Date.now();
        if (now - lastTime >= 1000) {
            camFpsBadge.textContent = `${frameCount} FPS`;
            frameCount = 0;
            lastTime = now;
        }

        const ctx = camCanvas.getContext('2d');
        camCanvas.width = camVideo.videoWidth;
        camCanvas.height = camVideo.videoHeight;
        if (camCanvas.width === 0) { isProcessing = false; return; }
        
        ctx.drawImage(camVideo, 0, 0, camCanvas.width, camCanvas.height);
        const dataUrl = camCanvas.toDataURL('image/jpeg', 0.8);

        try {
            const res = await fetch('/detect_frame', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ frame: dataUrl })
            });
            const data = await res.json();
            if (data.success) {
                camResult.src = data.result_image;
                
                // Update tags
                camLiveTags.innerHTML = '';
                data.detections.forEach(det => {
                    const tag = document.createElement('div');
                    tag.className = 'cam-tag';
                    tag.textContent = `${det.label} (${det.confidence}%)`;
                    camLiveTags.appendChild(tag);
                });
            }
        } catch (e) {
            console.error('Frame drop');
        }
        isProcessing = false;
    }


    // ── BATCH ANALYZER ──
    const batchInputList = document.getElementById('batch-input-list');
    const batchRunsSelect = document.getElementById('batch-runs-select');
    const batchOutputList = document.getElementById('batch-output-list');
    const batchNoRuns = document.getElementById('batch-no-runs');
    const batchRunBtn = document.getElementById('batch-run-btn');
    
    const batchPreviewImg = document.getElementById('batch-preview-img');
    const batchPreviewVid = document.getElementById('batch-preview-vid');
    const batchPreviewPlaceholder = document.getElementById('batch-preview-placeholder');
    const batchPreviewName = document.getElementById('batch-preview-name');

    // Load data/images input list
    function loadInputList() {
        fetch('/data_images_list')
            .then(res => res.json())
            .then(files => {
                batchInputList.innerHTML = '';
                if (files.length === 0) {
                    batchInputList.innerHTML = '<li class="no-detection">No files in data/images</li>';
                    return;
                }
                files.forEach(file => {
                    const li = document.createElement('li');
                    li.className = 'batch-file-item';
                    li.innerHTML = `
                        <span class="batch-file-name" title="${file.filename}">${file.filename}</span>
                        <span class="batch-file-type-icon">${file.type}</span>
                    `;
                    batchInputList.appendChild(li);
                });
            });
    }

    // Load detection runs list
    function loadRunsList(selectRunName = null) {
        fetch('/runs_list')
            .then(res => res.json())
            .then(runs => {
                batchRunsSelect.innerHTML = '';
                if (runs.length === 0) {
                    batchRunsSelect.innerHTML = '<option value="">No runs</option>';
                    batchNoRuns.classList.remove('hidden');
                    batchOutputList.innerHTML = '';
                    return;
                }
                batchNoRuns.classList.add('hidden');
                runs.forEach(run => {
                    const opt = document.createElement('option');
                    opt.value = run;
                    opt.textContent = run;
                    batchRunsSelect.appendChild(opt);
                });
                
                if (selectRunName) {
                    batchRunsSelect.value = selectRunName;
                }
                loadRunDetails(batchRunsSelect.value);
            });
    }

    // Load files within a selected run
    function loadRunDetails(runName) {
        if (!runName) {
            batchOutputList.innerHTML = '';
            return;
        }
        fetch(`/run_details/${runName}`)
            .then(res => res.json())
            .then(data => {
                batchOutputList.innerHTML = '';
                if (data.files.length === 0) {
                    batchOutputList.innerHTML = '<li class="no-detection">No files in run</li>';
                    return;
                }
                data.files.forEach(file => {
                    const li = document.createElement('li');
                    li.className = 'batch-file-item';
                    li.innerHTML = `
                        <span class="batch-file-name" title="${file.filename}">${file.filename}</span>
                        <span class="batch-file-type-icon">${file.type}</span>
                    `;
                    li.addEventListener('click', () => {
                        document.querySelectorAll('#batch-output-list .batch-file-item').forEach(item => item.classList.remove('active'));
                        li.classList.add('active');
                        previewFile(runName, file.filename, file.type);
                    });
                    batchOutputList.appendChild(li);
                });
            });
    }

    // Preview selected processed file
    function previewFile(runName, filename, type) {
        batchPreviewPlaceholder.classList.add('hidden');
        batchPreviewImg.classList.add('hidden');
        batchPreviewVid.classList.add('hidden');
        batchPreviewName.textContent = filename;

        const url = `/serve_run/${runName}/${filename}`;
        
        if (type === 'image') {
            batchPreviewImg.src = url;
            batchPreviewImg.classList.remove('hidden');
        } else if (type === 'video') {
            batchPreviewVid.src = url;
            batchPreviewVid.classList.remove('hidden');
            batchPreviewVid.load();
            batchPreviewVid.play();
        }
    }

    batchRunsSelect.addEventListener('change', () => {
        loadRunDetails(batchRunsSelect.value);
        batchPreviewPlaceholder.classList.remove('hidden');
        batchPreviewImg.classList.add('hidden');
        batchPreviewVid.classList.add('hidden');
        batchPreviewName.textContent = 'No file selected';
    });

    // Run batch detection click
    batchRunBtn.addEventListener('click', () => {
        batchRunBtn.disabled = true;
        batchRunBtn.innerHTML = '<span class="pulse-dot"></span> Processing...';
        showToast('Running batch detection on data/images...', 'info');

        fetch('/run_batch_detect', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                batchRunBtn.disabled = false;
                batchRunBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="margin-right:2px;"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg> Run Detection`;
                if (!data.success) throw new Error(data.error);
                
                showToast(`Batch run completed: ${data.run_name}`, 'success');
                loadRunsList(data.run_name);
            })
            .catch(err => {
                batchRunBtn.disabled = false;
                batchRunBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="margin-right:2px;"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg> Run Detection`;
                showToast('Batch execution failed: ' + err.message, 'error');
            });
    });

    // Initial loading
    loadInputList();
    loadRunsList();

    // Set footer time
    document.getElementById('footer-time').textContent = new Date().getFullYear();
});

