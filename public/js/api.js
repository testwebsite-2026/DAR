// Thin wrapper around fetch for talking to the ILDF DAR Batangas API.
// All requests are same-origin, so the session cookie travels automatically.
var Api = (function () {
  function request(method, url, body, isFormData) {
    var opts = { method: method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined && body !== null) {
      if (isFormData) {
        opts.body = body; // browser sets multipart headers itself
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    return fetch(url, opts).then(function (res) {
      if (res.status === 204) return null;
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  return {
    getSession: function () { return request('GET', '/api/session'); },
    login: function (username, password) { return request('POST', '/api/login', { username: username, password: password }); },
    logout: function () { return request('POST', '/api/logout'); },
    changePassword: function (currentPassword, newPassword) {
      return request('POST', '/api/change-password', { currentPassword: currentPassword, newPassword: newPassword });
    },
    getClusters: function () { return request('GET', '/api/clusters'); },
    getFolders: function (clusterSlug, municipalitySlug) {
      var q = '?cluster=' + encodeURIComponent(clusterSlug) + '&municipality=' + encodeURIComponent(municipalitySlug);
      return request('GET', '/api/folders' + q);
    },
    createFolder: function (payload) { return request('POST', '/api/folders', payload); },
    getFolder: function (id) { return request('GET', '/api/folders/' + id); },
    deleteFolder: function (id) { return request('DELETE', '/api/folders/' + id); },
    uploadFile: function (folderId, formData) { return request('POST', '/api/folders/' + folderId + '/files', formData, true); },
    deleteFile: function (id) { return request('DELETE', '/api/files/' + id); },
    previewUrl: function (id) { return '/api/files/' + id + '/preview'; },
    downloadUrl: function (id) { return '/api/files/' + id + '/download'; }
  };
})();
