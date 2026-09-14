(function () {
  'use strict';

  var state = {
    loggedIn: false,
    username: '',
    loginError: '',
    loginBusy: false,
    booted: false,

    view: 'home', // home | cluster | municipality | folder
    clusters: [],
    categories: [],
    currentClusterSlug: null,
    currentMunicipalitySlug: null,
    currentFolderId: null,

    homeSearch: '',
    folderListSearch: '',
    fileListSearch: '',

    folders: [],
    foldersLoading: false,
    folderDetail: null,
    folderDetailLoading: false,

    showFolderForm: false,
    folderForm: { titleNumber: '', sequenceNumber: '', name: '', location: '', totalArea: '' },
    folderFormBusy: false,

    pendingFile: null, // { file: File, previewUrl }
    uploadMsg: null,
    uploadBusy: false,
    selectedCategory: null,

    previewModal: null // { id, name, mime }
  };

  /* ===== BOOT ===== */
  function boot() {
    Api.getSession().then(function (data) {
      state.booted = true;
      if (data.loggedIn) {
        state.loggedIn = true;
        state.username = data.username;
        loadClustersThenRender();
      } else {
        render();
      }
    }).catch(function () {
      state.booted = true;
      render();
    });
  }

  function loadClustersThenRender() {
    Api.getClusters().then(function (data) {
      state.clusters = data.clusters;
      state.categories = data.categories;
      render();
    }).catch(function (err) {
      toast(err.message || 'Could not load cluster data.', 'err');
      render();
    });
  }

  /* ===== TOASTS ===== */
  function toast(message, kind) {
    var region = document.getElementById('toast-region');
    if (!region) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' err' : '');
    el.textContent = message;
    region.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .2s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 220);
    }, 3200);
  }

  /* ===== RENDER DISPATCH ===== */
  function render() {
    var root = document.getElementById('root');
    if (!state.booted) {
      root.innerHTML = bootLoaderHtml();
      return;
    }
    if (!state.loggedIn) {
      root.innerHTML = renderLogin();
      bindLogin();
      return;
    }
    var html = renderLetterhead() + '<div class="shell">';
    if (state.view === 'folder') html += renderFolder();
    else if (state.view === 'municipality') html += renderMunicipality();
    else if (state.view === 'cluster') html += renderCluster();
    else html += renderHome();
    html += '</div>' + renderFooter();
    if (state.previewModal) html += renderPreviewModal();
    root.innerHTML = html;

    bindGlobal();
    if (state.view === 'folder') bindFolder();
    if (state.view === 'municipality') bindMunicipality();
    if (state.view === 'cluster') bindCluster();
    if (state.view === 'home') bindHome();
    if (state.previewModal) bindPreviewModal();
  }

  function bootLoaderHtml() {
    return '<div class="boot-loader"><img src="/assets/logo.webp" class="boot-logo" alt="" />' +
      '<span>Loading ILDF DAR Batangas…</span></div>';
  }

  /* ===== LOGIN ===== */
  function renderLogin() {
    return '' +
    '<div class="login-wrap">' +
      '<div class="login-card">' +
        '<div class="login-seal"><img src="/assets/logo.webp" alt="ILDF DAR Batangas logo" /></div>' +
        '<h1>ILDF DAR Batangas</h1>' +
        '<p class="login-sub">Republic of the Philippines &middot; Department of Agrarian Reform<br/>Batangas Provincial Office — Records Portal</p>' +
        '<div class="field"><label for="username">Username</label>' +
          '<input id="username" type="text" autocomplete="username" placeholder="Enter username" /></div>' +
        '<div class="field"><label for="password">Password</label>' +
          '<input id="password" type="password" autocomplete="current-password" placeholder="Enter password" /></div>' +
        (state.loginError ? '<div class="login-error">' + escapeHtml(state.loginError) + '</div>' : '') +
        '<button class="btn-primary" id="login-btn" ' + (state.loginBusy ? 'disabled' : '') + '>' +
          (state.loginBusy ? 'Signing in…' : 'Sign in') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function bindLogin() {
    var btn = document.getElementById('login-btn');
    if (!btn) return;
    function attempt() {
      var u = document.getElementById('username').value.trim();
      var p = document.getElementById('password').value;
      if (!u || !p) {
        state.loginError = 'Please enter both a username and password.';
        render();
        return;
      }
      state.loginBusy = true;
      state.loginError = '';
      render();
      Api.login(u, p).then(function (data) {
        state.loggedIn = true;
        state.username = data.username;
        state.loginBusy = false;
        loadClustersThenRender();
      }).catch(function (err) {
        state.loginBusy = false;
        state.loginError = err.message || 'Incorrect username or password.';
        render();
      });
    }
    btn.addEventListener('click', attempt);
    document.getElementById('password').addEventListener('keypress', function (e) {
      if (e.key === 'Enter') attempt();
    });
  }

  /* ===== LETTERHEAD / FOOTER ===== */
  function renderLetterhead() {
    return '' +
    '<div class="letterhead"><div class="letterhead-inner">' +
      '<div class="letterhead-logo"><img src="/assets/logo.webp" alt="ILDF DAR Batangas logo" /></div>' +
      '<div class="letterhead-text">' +
        '<p class="agency">Republic of the Philippines &middot; Department of Agrarian Reform</p>' +
        '<h1>ILDF DAR Batangas</h1>' +
      '</div>' +
      '<div class="letterhead-right">' +
        '<span class="who">Signed in as <b>' + escapeHtml(state.username) + '</b></span>' +
        '<button class="btn-logout" id="logout-btn">Log out</button>' +
      '</div>' +
    '</div></div>';
  }

  function renderFooter() {
    return '<footer class="site-footer">ILDF DAR Batangas &middot; Department of Agrarian Reform — Batangas Provincial Office &middot; Internal municipal records system</footer>';
  }

  function bindGlobal() {
    var lb = document.getElementById('logout-btn');
    if (lb) lb.addEventListener('click', function () {
      Api.logout().then(function () {
        state.loggedIn = false;
        state.view = 'home';
        render();
      });
    });
  }

  /* ===== HOME (clusters) ===== */
  function renderHome() {
    var html = '<div class="hero">' +
      '<div class="hero-eyebrow">DARMO Clusters</div>' +
      '<h2>Provincial Cluster Directory</h2>' +
      '<p>Select a cluster to browse its municipalities, title folders, and supporting documents.</p>' +
      '<div class="search-row">' +
        '<input id="home-search" type="text" placeholder="Search by cluster number or DARMO office…" value="' + escapeHtml(state.homeSearch) + '" />' +
      '</div>' +
      '<div class="search-meta">' + state.clusters.length + ' clusters total</div>' +
    '</div>';

    var q = state.homeSearch.toLowerCase();
    var filtered = state.clusters.filter(function (c) {
      return ('cluster ' + c.id).includes(q) || c.office.toLowerCase().includes(q) || c.marpo.toLowerCase().includes(q);
    });

    html += '<div class="cluster-grid">';
    if (filtered.length === 0) {
      html += '<div class="empty-state"><span class="big">No matching clusters</span>Try a different search term.</div>';
    } else {
      filtered.forEach(function (c) {
        html += '<div class="cluster-card" data-cluster="' + c.slug + '">' +
          '<div class="cluster-num">Cluster ' + c.id + '</div>' +
          '<div class="cluster-marpo">' + escapeHtml(c.marpo) + '</div>' +
          '<div class="cluster-muni">' + escapeHtml(c.municipalities.map(function (m) { return m.name; }).join(', ')) + '</div>' +
        '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function bindHome() {
    var search = document.getElementById('home-search');
    if (search) search.addEventListener('input', function (e) { state.homeSearch = e.target.value; render(); });
    document.querySelectorAll('.cluster-card').forEach(function (card) {
      card.addEventListener('click', function () {
        state.view = 'cluster';
        state.currentClusterSlug = card.getAttribute('data-cluster');
        render();
      });
    });
  }

  /* ===== CLUSTER (municipalities) ===== */
  function renderCluster() {
    var cluster = findCluster(state.currentClusterSlug);
    if (!cluster) return '<div class="empty-state">Cluster not found.</div>';

    var html = '<div class="breadcrumb"><button id="back-home">&larr; Back to clusters</button></div>';
    html += '<div class="hero">' +
      '<div class="hero-eyebrow">Cluster ' + cluster.id + '</div>' +
      '<h2>' + escapeHtml(cluster.marpo) + '</h2>' +
      '<p>DARMO Office: ' + escapeHtml(cluster.office) + '</p>' +
    '</div>';

    html += '<div class="panel"><div class="panel-header"><h3>Select a Municipality</h3></div>' +
      '<div class="municipality-grid">';
    cluster.municipalities.forEach(function (m) {
      html += '<button class="municipality-btn" data-municipality="' + m.slug + '"><span class="ico">&#128193;</span>' + escapeHtml(m.name) + '</button>';
    });
    html += '</div></div>';
    return html;
  }

  function bindCluster() {
    var back = document.getElementById('back-home');
    if (back) back.addEventListener('click', function () { state.view = 'home'; render(); });
    document.querySelectorAll('.municipality-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.currentMunicipalitySlug = btn.getAttribute('data-municipality');
        state.view = 'municipality';
        state.folderListSearch = '';
        state.showFolderForm = false;
        render();
        loadFolders();
      });
    });
  }

  /* ===== MUNICIPALITY (folders) ===== */
  function loadFolders() {
    state.foldersLoading = true;
    render();
    Api.getFolders(state.currentClusterSlug, state.currentMunicipalitySlug).then(function (data) {
      state.folders = data.folders;
      state.foldersLoading = false;
      render();
    }).catch(function (err) {
      state.foldersLoading = false;
      toast(err.message || 'Could not load folders.', 'err');
      render();
    });
  }

  function renderMunicipality() {
    var cluster = findCluster(state.currentClusterSlug);
    if (!cluster) return '<div class="empty-state">Cluster not found.</div>';
    var muni = cluster.municipalities.find(function (m) { return m.slug === state.currentMunicipalitySlug; });
    if (!muni) return '<div class="empty-state">Municipality not found.</div>';

    var html = '<div class="breadcrumb"><button id="back-cluster">&larr; Back to Cluster ' + cluster.id + '</button></div>';
    html += '<div class="hero"><h2>' + escapeHtml(muni.name) + '</h2></div>';

    html += '<div class="cluster-details-panel">' +
      '<div class="detail-header">Municipal Office Information</div>' +
      '<div class="detail-row"><span class="detail-label">Cluster</span><span class="detail-value">Cluster ' + cluster.id + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">DARMO Office</span><span class="detail-value">' + escapeHtml(muni.office) + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">Email Address</span><span class="detail-value">' + escapeHtml(muni.email) + '</span></div>' +
      '<div class="detail-row last"><span class="detail-label">Address</span><span class="detail-value">' + escapeHtml(muni.address) + '</span></div>' +
    '</div>';

    html += '<div class="upload-section">' +
      '<div class="upload-title">&#128193; Create New Title Folder</div>' +
      '<div class="grid-2">' +
        field('title-number', 'Title Number', state.folderForm.titleNumber, 'e.g. CLOA-4108') +
        field('seq-number', 'Sequence Number', state.folderForm.sequenceNumber, 'e.g. 001') +
        field('folder-name', 'ARB / Landholder Name', state.folderForm.name, 'Full name') +
        field('folder-location', 'Location', state.folderForm.location, 'Barangay, municipality') +
      '</div>' +
      field('folder-area', 'Total Area (sqm)', state.folderForm.totalArea, 'e.g. 12,500') +
      '<div class="form-actions">' +
        '<button class="btn-add" id="create-folder-btn" ' + (state.folderFormBusy ? 'disabled' : '') + '>' + (state.folderFormBusy ? 'Creating…' : 'Create Folder') + '</button>' +
      '</div>' +
    '</div>';

    html += '<div class="panel"><div class="panel-header"><h3>&#128193; Title Folders (' + state.folders.length + ')</h3>' +
      '<div class="local-search"><input id="folder-search" placeholder="Search folders…" value="' + escapeHtml(state.folderListSearch) + '" /></div>' +
    '</div>';

    if (state.foldersLoading) {
      html += '<div class="loading-note">Loading folders…</div>';
    } else {
      var q = state.folderListSearch.toLowerCase();
      var filtered = state.folders.filter(function (f) {
        return (f.title_number + ' ' + f.name + ' ' + f.location).toLowerCase().includes(q);
      });
      if (filtered.length === 0) {
        html += '<div class="empty-state"><span class="big">No folders yet</span>Create the first title folder above.</div>';
      } else {
        html += '<div class="folder-list">';
        filtered.forEach(function (f) {
          html += '<div class="folder-row" data-folder="' + f.id + '">' +
            '<span class="folder-icon">&#128193;</span>' +
            '<div class="folder-main">' +
              '<div class="folder-title">' + escapeHtml(f.title_number) + ' — ' + escapeHtml(f.name) + '</div>' +
              '<div class="folder-meta">' + escapeHtml(f.location) + ' &middot; ' + escapeHtml(f.total_area) + ' sqm &middot; ' + f.file_count + ' file(s)</div>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';
      }
    }
    html += '</div>';
    return html;
  }

  function field(id, label, value, placeholder) {
    return '<div class="field"><label for="' + id + '">' + escapeHtml(label) + '</label>' +
      '<input id="' + id + '" placeholder="' + escapeHtml(placeholder || '') + '" value="' + escapeHtml(value) + '" /></div>';
  }

  function bindMunicipality() {
    var back = document.getElementById('back-cluster');
    if (back) back.addEventListener('click', function () { state.view = 'cluster'; render(); });

    var inputs = [
      { id: 'title-number', key: 'titleNumber' },
      { id: 'seq-number', key: 'sequenceNumber' },
      { id: 'folder-name', key: 'name' },
      { id: 'folder-location', key: 'location' },
      { id: 'folder-area', key: 'totalArea' }
    ];
    inputs.forEach(function (inp) {
      var el = document.getElementById(inp.id);
      if (el) el.addEventListener('input', function (e) { state.folderForm[inp.key] = e.target.value; });
    });

    var createBtn = document.getElementById('create-folder-btn');
    if (createBtn) createBtn.addEventListener('click', function () {
      var f = state.folderForm;
      if (!f.titleNumber || !f.sequenceNumber || !f.name || !f.location || !f.totalArea) {
        toast('Please fill in all folder details.', 'err');
        return;
      }
      state.folderFormBusy = true;
      render();
      Api.createFolder({
        clusterSlug: state.currentClusterSlug,
        municipalitySlug: state.currentMunicipalitySlug,
        titleNumber: f.titleNumber,
        sequenceNumber: f.sequenceNumber,
        name: f.name,
        location: f.location,
        totalArea: f.totalArea
      }).then(function () {
        state.folderFormBusy = false;
        state.folderForm = { titleNumber: '', sequenceNumber: '', name: '', location: '', totalArea: '' };
        toast('Folder created.');
        loadFolders();
      }).catch(function (err) {
        state.folderFormBusy = false;
        toast(err.message || 'Could not create folder.', 'err');
        render();
      });
    });

    var search = document.getElementById('folder-search');
    if (search) search.addEventListener('input', function (e) { state.folderListSearch = e.target.value; render(); });

    document.querySelectorAll('.folder-row').forEach(function (row) {
      row.addEventListener('click', function () {
        state.currentFolderId = row.getAttribute('data-folder');
        state.view = 'folder';
        state.fileListSearch = '';
        state.pendingFile = null;
        state.uploadMsg = null;
        render();
        loadFolderDetail();
      });
    });
  }

  /* ===== FOLDER (files) ===== */
  function loadFolderDetail() {
    state.folderDetailLoading = true;
    render();
    Api.getFolder(state.currentFolderId).then(function (data) {
      state.folderDetail = data;
      state.folderDetailLoading = false;
      render();
    }).catch(function (err) {
      state.folderDetailLoading = false;
      toast(err.message || 'Could not load folder.', 'err');
      render();
    });
  }

  function renderFolder() {
    if (state.folderDetailLoading || !state.folderDetail) {
      return '<div class="loading-note">Loading folder…</div>';
    }
    var d = state.folderDetail;
    var folder = d.folder, files = d.files || [], muni = d.municipality;
    var backText = muni ? escapeHtml(muni.name) : 'municipality';

    var html = '<div class="breadcrumb"><button id="back-municipality">&larr; Back to ' + backText + '</button></div>';
    html += '<div class="hero"><h2>' + escapeHtml(folder.title_number) + '</h2>' +
      '<p>' + escapeHtml(folder.name) + ' &middot; ' + escapeHtml(folder.location) + ' &middot; ' + escapeHtml(folder.total_area) + ' sqm</p></div>';

    html += '<div class="upload-section">' +
      '<div class="upload-title">Upload a Document</div>' +
      '<div class="file-input-wrap" id="drop-zone">' +
        '<div>Select or drop a file to upload</div>' +
        '<input type="file" id="file-input" />' +
        '<div class="file-chosen">' + (state.pendingFile ? ('Selected: ' + escapeHtml(state.pendingFile.file.name) + ' (' + formatSize(state.pendingFile.file.size) + ')') : 'No file selected yet · 25MB max') + '</div>' +
      '</div>' +
      '<div class="field"><label for="doc-category">Document Form</label>' +
        '<select id="doc-category">' +
          state.categories.map(function (c) { return '<option value="' + escapeHtml(c) + '"' + (state.selectedCategory === c ? ' selected' : '') + '>' + escapeHtml(c) + '</option>'; }).join('') +
        '</select></div>' +
      '<div class="form-actions"><button class="btn-add" id="add-doc-btn" ' + (state.uploadBusy ? 'disabled' : '') + '>' + (state.uploadBusy ? 'Uploading…' : 'Add to folder') + '</button></div>' +
      (state.uploadMsg ? ('<div class="inline-msg ' + state.uploadMsg.type + '">' + escapeHtml(state.uploadMsg.text) + '</div>') : '') +
    '</div>';

    if (state.pendingFile && isImageFile(state.pendingFile.file.type)) {
      html += '<div class="upload-section"><div class="upload-title">Preview before upload</div>' +
        '<div style="text-align:center;"><img src="' + state.pendingFile.previewUrl + '" style="max-width:100%;max-height:280px;border-radius:4px;" /></div></div>';
    }

    html += '<div class="panel"><div class="panel-header"><h3>&#128196; Files (' + files.length + ')</h3>' +
      '<div class="local-search"><input id="file-search" placeholder="Search files in folder…" value="' + escapeHtml(state.fileListSearch) + '" /></div>' +
    '</div>';

    var q = state.fileListSearch.toLowerCase();
    var filtered = files.filter(function (f) {
      return (f.title + ' ' + (f.category || '') + ' ' + (f.description || '')).toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      html += '<div class="empty-state"><span class="big">No files yet</span>Upload your first file above.</div>';
    } else {
      html += '<div class="record-list">';
      filtered.forEach(function (f) {
        html += '<div class="record-row">' +
          '<span class="record-icon">' + fileIcon(f.mime_type) + '</span>' +
          '<div class="record-main">' +
            '<div class="record-title-row"><span class="record-title">' + escapeHtml(f.title) + '</span><span class="tag">' + escapeHtml(f.category || 'Uncategorized') + '</span></div>' +
            '<div class="record-meta">' +
              '<span>' + formatSize(f.file_size) + '</span>' +
              '<span>Added ' + escapeHtml(formatDate(f.created_at)) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="record-actions">' +
            '<button class="btn-mini" data-preview="' + f.id + '" data-name="' + escapeHtml(f.title) + '" data-mime="' + escapeHtml(f.mime_type || '') + '">Preview</button>' +
            '<a class="btn-mini gold" href="' + Api.downloadUrl(f.id) + '">Download</a>' +
            '<button class="btn-mini danger" data-delete="' + f.id + '">Delete</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function bindFolder() {
    var back = document.getElementById('back-municipality');
    if (back) back.addEventListener('click', function () {
      state.view = 'municipality';
      state.folderDetail = null;
      render();
      loadFolders();
    });

    var fileInput = document.getElementById('file-input');
    var dropZone = document.getElementById('drop-zone');
    if (fileInput) fileInput.addEventListener('change', function (e) { handleChosenFile(e.target.files[0]); });
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(function (evt) {
        dropZone.addEventListener(evt, function (e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
      });
      ['dragleave', 'drop'].forEach(function (evt) {
        dropZone.addEventListener(evt, function (e) { e.preventDefault(); dropZone.classList.remove('drag-over'); });
      });
      dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleChosenFile(e.dataTransfer.files[0]);
      });
    }

    var catSelect = document.getElementById('doc-category');
    if (catSelect) catSelect.addEventListener('change', function (e) { state.selectedCategory = e.target.value; });

    var search = document.getElementById('file-search');
    if (search) search.addEventListener('input', function (e) { state.fileListSearch = e.target.value; render(); });

    var addBtn = document.getElementById('add-doc-btn');
    if (addBtn) addBtn.addEventListener('click', function () {
      if (!state.pendingFile) {
        toast('Please select a file before adding it.', 'err');
        return;
      }
      var category = document.getElementById('doc-category').value;
      state.uploadBusy = true;
      state.uploadMsg = null;
      render();

      var formData = new FormData();
      formData.append('file', state.pendingFile.file);
      formData.append('category', category);

      Api.uploadFile(state.currentFolderId, formData).then(function () {
        state.uploadBusy = false;
        state.uploadMsg = { type: 'ok', text: 'File added to folder.' };
        revokePendingPreview();
        state.pendingFile = null;
        loadFolderDetail();
      }).catch(function (err) {
        state.uploadBusy = false;
        state.uploadMsg = { type: 'err', text: err.message || 'Could not save the file. Try again.' };
        render();
      });
    });

    document.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-delete');
        if (!confirm('Delete this file? This cannot be undone.')) return;
        Api.deleteFile(id).then(function () {
          toast('File deleted.');
          loadFolderDetail();
        }).catch(function (err) {
          toast(err.message || 'Could not delete the file.', 'err');
        });
      });
    });

    document.querySelectorAll('[data-preview]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.previewModal = {
          id: btn.getAttribute('data-preview'),
          name: btn.getAttribute('data-name'),
          mime: btn.getAttribute('data-mime')
        };
        render();
      });
    });
  }

  function handleChosenFile(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      state.uploadMsg = { type: 'err', text: 'File is larger than 25MB. Please choose a smaller file.' };
      state.pendingFile = null;
      render();
      return;
    }
    revokePendingPreview();
    var previewUrl = isImageFile(file.type) ? URL.createObjectURL(file) : null;
    state.pendingFile = { file: file, previewUrl: previewUrl };
    state.uploadMsg = null;
    render();
  }

  function revokePendingPreview() {
    if (state.pendingFile && state.pendingFile.previewUrl) {
      URL.revokeObjectURL(state.pendingFile.previewUrl);
    }
  }

  /* ===== PREVIEW MODAL ===== */
  function renderPreviewModal() {
    var m = state.previewModal;
    var url = Api.previewUrl(m.id);
    var body;
    if (m.mime && m.mime.indexOf('image/') === 0) {
      body = '<img src="' + url + '" alt="' + escapeHtml(m.name) + '" />';
    } else if (m.mime === 'application/pdf') {
      body = '<iframe src="' + url + '" title="' + escapeHtml(m.name) + '"></iframe>';
    } else if (m.mime && m.mime.indexOf('text/') === 0) {
      body = '<iframe src="' + url + '" title="' + escapeHtml(m.name) + '"></iframe>';
    } else {
      body = '<div class="modal-fallback"><span class="ico">' + fileIcon(m.mime) + '</span>' +
        'A preview isn\'t available for this file type in-browser.<br/>Use Download or Open in new tab instead.</div>';
    }
    return '<div class="modal-overlay" id="preview-overlay">' +
      '<div class="modal-card">' +
        '<div class="modal-header"><h3>' + escapeHtml(m.name) + '</h3><button class="modal-close" id="preview-close">&times;</button></div>' +
        '<div class="modal-body">' + body + '</div>' +
        '<div class="modal-footer">' +
          '<a class="btn-mini gold" href="' + url + '" target="_blank" rel="noopener">Open in new tab</a>' +
          '<a class="btn-mini" href="' + Api.downloadUrl(m.id) + '">Download</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function bindPreviewModal() {
    var overlay = document.getElementById('preview-overlay');
    var close = document.getElementById('preview-close');
    function dismiss() { state.previewModal = null; render(); }
    if (close) close.addEventListener('click', dismiss);
    if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) dismiss(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', esc); }
    });
  }

  /* ===== HELPERS ===== */
  function findCluster(slug) {
    return state.clusters.find(function (c) { return c.slug === slug; }) || null;
  }
  function formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function formatDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso.replace(' ', 'T') + 'Z');
      return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return iso; }
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function isImageFile(mimeType) { return !!mimeType && mimeType.indexOf('image/') === 0; }
  function fileIcon(mimeType) {
    if (!mimeType) return '&#128196;';
    if (mimeType.indexOf('image/') === 0) return '&#128247;';
    if (mimeType === 'application/pdf') return '&#128209;';
    if (mimeType.indexOf('word') !== -1) return '&#128221;';
    if (mimeType.indexOf('sheet') !== -1 || mimeType.indexOf('excel') !== -1 || mimeType === 'text/csv') return '&#128202;';
    return '&#128196;';
  }

  boot();
})();
