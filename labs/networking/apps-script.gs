/**
 * Saltmarsh Labs — shared submission handler (Network+ / AP Networking library)
 * ----------------------------------------------------------------------------
 * One web app serves the whole library; labs route by `assignmentId`.
 * For each submission it: validates the token + assignment, decodes the
 * screenshot, creates a Google Doc record (info table + results + image),
 * files the Doc in a per-assignment Drive subfolder, appends a gradebook row,
 * and returns {success, docUrl}.
 *
 * Server time is authoritative; the client's timestamp is recorded for reference.
 *
 * © 2026 <AUTHOR / RIGHTSHOLDER NAME>. Reuse within your institution permitted;
 * redistribution/resale prohibited. Replace with your own license terms.
 *
 * ── SCRIPT PROPERTIES (Project Settings → Script properties) ──────────────────
 *   ROOT_FOLDER_ID   Drive folder ID that holds all per-assignment subfolders
 *   GRADEBOOK_ID     Google Sheet ID for the gradebook
 *   SUBMIT_TOKEN     per-cohort secret; must match each lab's submissionToken
 *   ALLOWED_IDS      comma-separated assignmentIds, e.g.
 *                    "netplus-ipv6-static-addr,netplus-dhcp-scope"
 *   MAX_PNG_BYTES    optional; default 3000000 (~3 MB) decoded
 *   MAX_HANDLE_LEN   optional; default 40
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Optional server-side answer keys for authoritative re-scoring.
 *  If an assignmentId appears here, the server recomputes the question score and
 *  records THAT as authoritative (see §7 of the build spec). Leave a lab out to
 *  trust the client's self-reported score (fine for formative work).
 */
var ANSWER_KEYS = {
  'netplus-ipv6-static-addr': { q1:'c', q2:'a', q3:'b', q4:'b' }
};

/* ---- AP Networking folder hierarchy (auto-generated) ---- */
var AP_UNITS = {
  "1": "Managing My Connections",
  "2": "Managing My Shared Connections",
  "3": "Managing Many Connections",
  "4": "Managing Our Global Connections"
};

var AP_TOPICS = {
  "1.1": "Fixing What's Slowing Me Down: Troubleshooting Issues on My Device",
  "1.2": "Getting the Most Out of My Network: Connecting and Configuring",
  "1.3": "What Could Go Wrong: Identifying the Security Needs of My Device",
  "1.4": "Locking It Down: Securing My Device",
  "2.1": "Missed Connection: Troubleshooting My SOHO Network",
  "2.2": "Identification Needed: Documenting My Network",
  "2.3": "Smart Moves: Upgrading My Network",
  "2.4": "Leveling Up: Advanced Features on My Network",
  "2.5": "Guarding My Network: Identifying Security Needs",
  "2.6": "Applying Defense: Securing My Network",
  "3.1": "Planning a Network: Choosing the Right Devices and Connections",
  "3.2": "Creating a Network: Switching and Topologies",
  "3.3": "Making It Work: Connecting, Configuring, and Verifying Access",
  "3.4": "Building the Boundaries: Identifying Segmentation Security",
  "3.5": "Controlling the Traffic: Firewalls and Filtering",
  "3.6": "Restored Connections: Documenting, Diagnosing, and Fixing",
  "4.1": "What Happens When Networks Break or Fail",
  "4.2": "The Language of the Network: Protocols and the OSI and TCP-IP Models",
  "4.3": "Tools of Network Analysts: Using the CLI",
  "4.4": "How Data Travel the Internet: Routing, Metrics, and Paths",
  "4.5": "From the Inside Out: Monitoring and Defending a Large Network",
  "4.6": "Moving Forward: Designing for Reliability and Growth"
};

var ASSIGNMENT_TOPIC = {
  "netplus-apipa-troubleshoot": "2.6",
  "netplus-arp-analyzer": "4.4",
  "netplus-arp-poison-detect": "2.2",
  "netplus-bandwidth-shaper": "3.5",
  "netplus-bench-bringup": "2.1",
  "netplus-broadband-hookup": "2.1",
  "netplus-campus-site-links": "2.2",
  "netplus-captive-portal": "3.3",
  "netplus-cli-connectivity": "4.3",
  "netplus-cli-triage": "3.6",
  "netplus-cname-records": "2.3",
  "netplus-conn-triage": "3.6",
  "netplus-decoy-watch": "4.5",
  "netplus-dhcp-client-fix": "2.6",
  "netplus-dhcp-exclusion": "2.3",
  "netplus-dhcp-options": "2.3",
  "netplus-dhcp-pool-exhaustion": "2.6",
  "netplus-dhcp-relay-helper": "3.4",
  "netplus-dhcp-rescue": "2.6",
  "netplus-dhcp-reservations": "2.3",
  "netplus-dhcp-scope": "3.3",
  "netplus-dhcp-scope-harborview": "3.3",
  "netplus-dhcp-scope-netforge": "2.3",
  "netplus-dhcp-scope-warehouse": "2.3",
  "netplus-dhcp-snooping-dai": "2.2",
  "netplus-disabled-port": "3.6",
  "netplus-dns-record-repair": "3.6",
  "netplus-dns-records": "2.3",
  "netplus-dns-resolver": "2.3",
  "netplus-dns-zones": "2.3",
  "netplus-edge-appliance-setup": "3.3",
  "netplus-edge-router-install": "3.2",
  "netplus-enterprise-wlan": "1.2",
  "netplus-ethernet-connect": "1.1",
  "netplus-fiber-crossconnect": "2.4",
  "netplus-fiber-link": "2.4",
  "netplus-find-rogue-port": "4.3",
  "netplus-guest-wlan-byod": "1.4",
  "netplus-ios-cli-basics": "3.3",
  "netplus-ip-config": "1.2",
  "netplus-ipconfig-gateway": "2.6",
  "netplus-ips-sensor-deploy": "3.5",
  "netplus-ipv4-tools": "4.3",
  "netplus-ipv6-static-addr": "4.4",
  "netplus-journald-logs": "4.5",
  "netplus-jumbo-mtu": "3.3",
  "netplus-l2-mac-spoof": "2.2",
  "netplus-lacp-etherchannel": "3.3",
  "netplus-link-aggregation": "3.3",
  "netplus-linux-route-trace": "4.3",
  "netplus-linux-static-ip": "1.2",
  "netplus-mac-acl-bench": "3.5",
  "netplus-media-converter-fiber-link": "2.4",
  "netplus-mgmt-svi-cli": "3.3",
  "netplus-nat-portforward": "3.5",
  "netplus-network-discovery": "4.3",
  "netplus-nic-install-verify": "1.1",
  "netplus-nic-swap": "1.1",
  "netplus-nic-teaming-ha": "3.1",
  "netplus-nic-ups-fieldcheck": "1.2",
  "netplus-nslookup-mail-routing": "4.3",
  "netplus-ntp-timesync": "4.2",
  "netplus-onpath-logs": "4.5",
  "netplus-outdoor-wireless-bridge": "3.1",
  "netplus-packet-anatomy": "4.4",
  "netplus-packet-trace": "4.3",
  "netplus-patch-panel-termination": "2.4",
  "netplus-phys-link-01": "3.6",
  "netplus-phys-link-down": "3.6",
  "netplus-physical-conn-tshoot": "3.6",
  "netplus-physical-connectivity": "3.6",
  "netplus-physical-link-fault": "3.6",
  "netplus-physical-power-trace": "2.4",
  "netplus-ping-traceroute-gateway": "4.3",
  "netplus-poe-priority": "2.4",
  "netplus-poe-voip-inline": "2.4",
  "netplus-port-discovery": "4.3",
  "netplus-port-mirror": "4.3",
  "netplus-powershell-remoting": "4.3",
  "netplus-rack-switch-cabling": "2.4",
  "netplus-radius-aaa": "2.6",
  "netplus-remote-trace": "1.1",
  "netplus-rogue-dhcp-defense": "4.5",
  "netplus-rogue-dhcp-hunt": "2.1",
  "netplus-rogue-remote-services": "1.4",
  "netplus-screened-subnet": "3.3",
  "netplus-screened-subnet-design": "3.4",
  "netplus-screened-subnet-firewall": "3.5",
  "netplus-secure-admin-access": "1.4",
  "netplus-secure-switch-access": "1.4",
  "netplus-site-walkthrough-idf": "2.2",
  "netplus-soho-gateway-fault": "2.6",
  "netplus-soho-ipfix": "2.6",
  "netplus-soho-topology": "2.3",
  "netplus-soho-wifi-setup": "1.2",
  "netplus-star-topology": "3.2",
  "netplus-static-ip-mobile": "1.2",
  "netplus-std-acl-deny-hosts": "3.5",
  "netplus-structured-cabling-run": "2.4",
  "netplus-subnet-routing": "3.4",
  "netplus-switch-firmware": "3.1",
  "netplus-switch-hardening": "3.4",
  "netplus-switch-mgmt-ip": "3.3",
  "netplus-switch-syslog": "4.5",
  "netplus-switching-loop": "3.6",
  "netplus-synflood-analysis": "4.1",
  "netplus-synflood-triage": "4.1",
  "netplus-syslog-forwarding": "4.5",
  "netplus-tcp-handshake": "4.2",
  "netplus-three-tier-build": "3.2",
  "netplus-troubleshoot-methodology": "3.6",
  "netplus-vlan-segment": "3.3",
  "netplus-vlan-trunk": "3.3",
  "netplus-voip-poe-connect": "2.4",
  "netplus-vpn-client": "1.4",
  "netplus-wap-guest": "2.5",
  "netplus-wifi-harden": "1.2",
  "netplus-wifi-profile": "1.2",
  "netplus-wifi-radio-disabled": "1.1",
  "netplus-wifi-triage": "1.1",
  "netplus-wireless-coverage-design": "2.2",
  "netplus-wireless-ips": "2.5",
  "netplus-wireless-rrm-tuning": "1.2",
  "netplus-wlan-controller-hardening": "2.5"
};


function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var ROOT_FOLDER_ID = req(props, 'ROOT_FOLDER_ID');
    var GRADEBOOK_ID   = req(props, 'GRADEBOOK_ID');
    var SUBMIT_TOKEN   = req(props, 'SUBMIT_TOKEN');
    var ALLOWED_IDS    = (props.getProperty('ALLOWED_IDS') || '')
                           .split(',').map(function(s){return s.trim();}).filter(String);
    var MAX_PNG_BYTES  = parseInt(props.getProperty('MAX_PNG_BYTES') || '3000000', 10);
    var MAX_HANDLE_LEN = parseInt(props.getProperty('MAX_HANDLE_LEN') || '40', 10);

    if (!e || !e.postData || !e.postData.contents) return json({success:false, error:'empty body'});

    var data;
    try { data = JSON.parse(e.postData.contents); }
    catch (err) { return json({success:false, error:'invalid JSON'}); }

    // ---- validation / hardening -------------------------------------------
    if (data.submissionToken !== SUBMIT_TOKEN) return json({success:false, error:'bad token'});

    var assignmentId = String(data.assignmentId || '').trim();
    if (!assignmentId) return json({success:false, error:'missing assignmentId'});
    if (ALLOWED_IDS.length && ALLOWED_IDS.indexOf(assignmentId) === -1)
      return json({success:false, error:'unknown assignmentId'});

    // accept either `handle` (preferred) or legacy `hackerName`
    var handle = String(data.handle || data.hackerName || '').trim();
    if (!handle) return json({success:false, error:'missing handle'});
    if (handle.length > MAX_HANDLE_LEN) handle = handle.substring(0, MAX_HANDLE_LEN);
    handle = handle.replace(/[\r\n\t]/g, ' ');

    var clientTs   = String(data.clientTimestamp || '');
    var objectives = Array.isArray(data.objectives) ? data.objectives.slice(0, 20) : [];
    var tasks      = Array.isArray(data.tasks) ? data.tasks : [];
    var questions  = Array.isArray(data.questions) ? data.questions : [];
    var clientScore = (data.score && typeof data.score === 'object') ? data.score : {earned:0,total:0};

    // ---- authoritative server timestamp -----------------------------------
    var serverDate = new Date();
    var serverIso  = serverDate.toISOString();

    // ---- optional authoritative re-scoring --------------------------------
    var scoreSource = 'client';
    var earned = num(clientScore.earned);
    var total  = num(clientScore.total);
    var key = ANSWER_KEYS[assignmentId];
    if (key) {
      var qEarned = 0, qTotal = Object.keys(key).length;
      questions.forEach(function(q){
        if (q && key[q.id] != null && String(q.answer) === String(key[q.id])) qEarned++;
        // overwrite the per-question correctness with the server verdict
        if (q && key[q.id] != null) q.correct = (String(q.answer) === String(key[q.id]));
      });
      var taskPass = tasks.filter(function(t){return t && t.passed;}).length;
      earned = taskPass + qEarned;
      total  = tasks.length + qTotal;
      scoreSource = 'server';
    }

    // ---- screenshot size cap ----------------------------------------------
    var png = String(data.screenshot || '');
    var imgBlob = null;
    if (png.indexOf('data:image/png;base64,') === 0) {
      var b64 = png.substring('data:image/png;base64,'.length);
      // rough decoded-size estimate before decoding
      if (b64.length * 0.75 <= MAX_PNG_BYTES) {
        try {
          var bytes = Utilities.base64Decode(b64);
          imgBlob = Utilities.newBlob(bytes, 'image/png', assignmentId + '.png');
        } catch (imgErr) { imgBlob = null; }
      }
    }

    // ---- build the Doc -----------------------------------------------------
    var docName = assignmentId + '__' + handle + '__' + serverIso;
    var doc = DocumentApp.create(docName);
    var body = doc.getBody();

    body.appendParagraph('Saltmarsh Labs — Submission Record')
        .setHeading(DocumentApp.ParagraphHeading.HEADING1);

    var info = body.appendTable([
      ['Field', 'Value'],
      ['Assignment', assignmentId],
      ['Callsign (handle)', handle],
      ['Blueprint tags', objectives.join('   ')],
      ['Score', earned + ' / ' + total + '  (' + scoreSource + '-scored)'],
      ['Server time (authoritative)', serverIso],
      ['Client time (reported)', clientTs || '—']
    ]);
    styleInfoTable(info);

    // tasks
    body.appendParagraph('Tasks').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    if (tasks.length) {
      tasks.forEach(function(t){
        body.appendListItem((t.passed ? '✓ ' : '✗ ') + (t.label || t.id))
            .setGlyphType(DocumentApp.GlyphType.BULLET);
      });
    } else { body.appendParagraph('(none reported)'); }

    // questions
    body.appendParagraph('Questions').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    if (questions.length) {
      questions.forEach(function(q, i){
        var mark = q.correct ? '✓' : '✗';
        var bonus = q.bonus ? ' [bonus]' : '';
        body.appendListItem(mark + ' Q' + (i+1) + bonus + ': answered "' + (q.answer||'—') + '"')
            .setGlyphType(DocumentApp.GlyphType.BULLET);
      });
    } else { body.appendParagraph('(none reported)'); }

    // screenshot
    if (imgBlob) {
      body.appendParagraph('Captured work').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      var img = body.appendImage(imgBlob);
      var w = img.getWidth(), h = img.getHeight();
      if (w > 480) { img.setWidth(480); img.setHeight(Math.round(h * 480 / w)); }
    }

    doc.saveAndClose();

    // ---- file the Doc: root / Unit / Topic / assignmentId -----------------
    var root      = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var topicCode = ASSIGNMENT_TOPIC[assignmentId] || apTopicFromObjectives(objectives) || '0.0';
    var unitN     = topicCode.split('.')[0];
    var unitName  = 'Unit ' + unitN + ' \u2014 ' + (AP_UNITS[unitN] || 'Unassigned');
    var topicName = topicCode + ' ' + (AP_TOPICS[topicCode] || 'Unassigned topic');
    var unitFolder  = getOrCreateSubfolder(root, safeName(unitName));
    var topicFolder = getOrCreateSubfolder(unitFolder, safeName(topicName));
    var sub         = getOrCreateSubfolder(topicFolder, assignmentId);
    var file = DriveApp.getFileById(doc.getId());
    sub.addFile(file);
    try { DriveApp.getRootFolder().removeFile(file); } catch (mvErr) {}
    var docUrl = doc.getUrl();

    // ---- append gradebook row ---------------------------------------------
    try {
      var sheet = SpreadsheetApp.openById(GRADEBOOK_ID).getSheets()[0];
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Server time','Callsign','Assignment','Blueprint tags',
                         'Earned','Total','Scored by','Client time','Doc link']);
      }
      var netTags = objectives.filter(function(o){return o.indexOf('N10') === 0;}).join(' ');
      var apTags  = objectives.filter(function(o){return o.indexOf('APNET') === 0;}).join(' ');
      sheet.appendRow([serverIso, handle, assignmentId,
                       (netTags + (apTags ? '  |  ' + apTags : '')),
                       earned, total, scoreSource, clientTs, docUrl]);
    } catch (sErr) { /* gradebook failure shouldn't break the learner's submit */ }

    return json({success:true, docUrl:docUrl, score:{earned:earned, total:total}, scoredBy:scoreSource});

  } catch (fatal) {
    return json({success:false, error:String(fatal)});
  }
}

/* GET is handy for a quick "is it deployed?" check in a browser. */
function doGet() {
  return json({success:true, service:'Saltmarsh Labs handler', time:new Date().toISOString()});
}

/* ----------------------------- helpers ----------------------------------- */
function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function req(props, name){
  var v = props.getProperty(name);
  if (!v) throw new Error('missing Script Property: ' + name);
  return v;
}
function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
function safeName(s){ return String(s).replace(/[\/\\:]+/g,'-').replace(/\s+/g,' ').trim(); }
function apTopicFromObjectives(objs){
  for (var i=0;i<(objs||[]).length;i++){ var m=String(objs[i]).match(/^APNET:([1-4]\.[1-6])/); if(m) return m[1]; }
  return '';
}
function getOrCreateSubfolder(parent, name){
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function styleInfoTable(table){
  table.setBorderWidth(1);
  var header = table.getRow(0);
  for (var c = 0; c < header.getNumCells(); c++){
    header.getCell(c).editAsText().setBold(true);
    header.getCell(c).setBackgroundColor('#0e7c86');
    header.getCell(c).editAsText().setForegroundColor('#ffffff');
  }
}
