'use strict';
'require baseclass';
'require dom';
'require poll';
'require rpc';
'require ui';

var callTempData = rpc.declare({
	object: 'luci.temp',
	method: 'getData'
});

var callUciGet = rpc.declare({
	object: 'uci',
	method: 'get',
	params: [ 'config', 'section' ],
	expect: { values: {} }
});

var callUciSet = rpc.declare({
	object: 'uci',
	method: 'set',
	params: [ 'config', 'section', 'values' ]
});

var callUciCommit = rpc.declare({
	object: 'uci',
	method: 'commit',
	params: [ 'config' ]
});

var SENSOR_LABELS = {
	'cpu-thermal': _('CPU'),
	'cpu_thermal': _('CPU'),
	'soc-thermal': _('SoC'),
	'mt7915_phy0': _('WiFi 2.4 GHz'),
	'mt7915_phy1': _('WiFi 5 GHz'),
	'mt7986_phy0': _('WiFi 2.4 GHz'),
	'mt7986_phy1': _('WiFi 5 GHz'),
	'pwmfan':      _('Fan'),
	'pwm-fan':     _('Fan')
};

var COLOR_OK   = '#5cb85c',
    COLOR_WARN = '#f0ad4e',
    COLOR_CRIT = '#d9534f';

return baseclass.extend({
	title: _('Temperature'),

	cfg: { interval: 5, warn: 60, crit: 75 },
	peaks: {},
	lastData: null,
	rootNode: null,
	pollFn: null,
	loaded: false,

	load: function() {
		/* Data refresh is driven by our own poll (configurable interval),
		 * so only do real work on the very first invocation. */
		if (this.loaded)
			return Promise.resolve(null);

		this.loaded = true;

		return Promise.all([
			L.resolveDefault(callUciGet('luci_temp', 'settings'), {}),
			L.resolveDefault(callTempData(), null)
		]);
	},

	render: function(data) {
		if (data && !this.rootNode) {
			this.rootNode = E('div');
			this.applyConfig(L.isObject(data[0]) ? data[0] : {});
			this.updateView(data[1]);
			this.startPoll();
		}

		return this.rootNode;
	},

	applyConfig: function(values) {
		this.cfg.interval = Math.min(3600, Math.max(1, parseInt(values.poll_interval) || 5));
		this.cfg.warn = Math.min(150, Math.max(20, parseInt(values.warn_temp) || 60));
		this.cfg.crit = Math.min(150, Math.max(this.cfg.warn + 1, parseInt(values.crit_temp) || 75));
	},

	startPoll: function() {
		if (this.pollFn)
			poll.remove(this.pollFn);

		this.pollFn = L.bind(function() {
			return L.resolveDefault(callTempData(), null)
				.then(L.bind(this.updateView, this));
		}, this);

		poll.add(this.pollFn, this.cfg.interval);
	},

	colorFor: function(t) {
		if (t >= this.cfg.crit)
			return COLOR_CRIT;

		if (t >= this.cfg.warn)
			return COLOR_WARN;

		return COLOR_OK;
	},

	renderSensorRow: function(s) {
		var t = s.temp / 1000,
		    pct = Math.max(0, Math.min(100, t)),
		    color = this.colorFor(t);

		var peak = this.peaks[s.id] = Math.max(this.peaks[s.id] || 0, t),
		    peakPct = Math.max(0, Math.min(100, peak));

		return E('div', { 'style': 'display:flex; align-items:center; gap:10px; margin:7px 0' }, [
			E('span', {
				'style': 'flex:0 0 9em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap',
				'title': s.name
			}, SENSOR_LABELS[s.name] || s.name),
			E('div', { 'style': 'position:relative; flex:1 1 auto; height:12px; background:rgba(128,128,128,.18); border-radius:6px' }, [
				E('div', { 'style': 'position:absolute; left:0; top:0; bottom:0; border-radius:6px; ' +
					'transition:width .4s ease; ' +
					'width:' + pct.toFixed(1) + '%; ' +
					'background:linear-gradient(90deg,' + COLOR_OK + ',' + color + ')' }),
				E('div', {
					'style': 'position:absolute; top:-2px; bottom:-2px; width:2px; background:rgba(128,128,128,.65); ' +
						'left:' + peakPct.toFixed(1) + '%',
					'title': _('Session peak') + ': ' + peak.toFixed(1) + ' °C'
				})
			]),
			E('span', { 'style': 'flex:0 0 5.5em; text-align:right; font-weight:bold; color:' + color },
				t.toFixed(1) + ' °C')
		]);
	},

	renderFanRow: function(f) {
		var txt;

		if (f.rpm != null)
			txt = '🌀 %d '.format(f.rpm) + _('rpm');
		else if (f.state != null && f.max_state)
			txt = (f.state == 0)
				? '🌀 ' + _('off')
				: '🌀 ' + _('level %d/%d').format(f.state, f.max_state) +
					(f.state == f.max_state ? ' (' + _('max') + ')' : '');
		else if (f.pwm != null)
			txt = '🌀 ' + _('PWM') + ' %d%%'.format(Math.round(f.pwm / 255 * 100));
		else
			return null;

		return E('div', { 'style': 'display:flex; align-items:center; gap:10px; margin:7px 0' }, [
			E('span', { 'style': 'flex:0 0 9em' }, SENSOR_LABELS[f.name] || f.name),
			E('span', { 'style': 'flex:1 1 auto; opacity:.8' }, txt)
		]);
	},

	updateView: function(data) {
		if (data)
			this.lastData = data;

		data = this.lastData;

		var sensors = (L.isObject(data) && Array.isArray(data.sensors)) ? data.sensors : [],
		    fans = (L.isObject(data) && Array.isArray(data.fans)) ? data.fans : [],
		    nodes = [];

		if (!sensors.length && !fans.length)
			nodes.push(E('em', {}, _('No temperature sensors found')));

		sensors.forEach(L.bind(function(s) { nodes.push(this.renderSensorRow(s)); }, this));
		fans.forEach(L.bind(function(f) {
			var row = this.renderFanRow(f);
			if (row) nodes.push(row);
		}, this));

		nodes.push(E('div', { 'style': 'display:flex; justify-content:flex-end; align-items:center; gap:10px; margin-top:8px' }, [
			E('span', { 'style': 'font-size:90%; opacity:.55' },
				_('Refresh every %d s · warn %d °C · crit %d °C').format(this.cfg.interval, this.cfg.warn, this.cfg.crit)),
			E('button', {
				'class': 'cbi-button cbi-button-neutral',
				'style': 'padding:1px 8px',
				'title': _('Settings'),
				'click': ui.createHandlerFn(this, 'handleSettings')
			}, '⚙')
		]));

		dom.content(this.rootNode, nodes);
	},

	handleSettings: function(ev) {
		var intervalInput = E('input', { 'type': 'number', 'class': 'cbi-input-text', 'min': '1', 'max': '3600', 'value': this.cfg.interval }),
		    warnInput = E('input', { 'type': 'number', 'class': 'cbi-input-text', 'min': '20', 'max': '150', 'value': this.cfg.warn }),
		    critInput = E('input', { 'type': 'number', 'class': 'cbi-input-text', 'min': '20', 'max': '150', 'value': this.cfg.crit });

		ui.showModal(_('Temperature: settings'), [
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Refresh interval, s')),
				E('div', { 'class': 'cbi-value-field' }, intervalInput)
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Warning threshold, °C')),
				E('div', { 'class': 'cbi-value-field' }, warnInput)
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Critical threshold, °C')),
				E('div', { 'class': 'cbi-value-field' }, critInput)
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-positive important',
					'click': ui.createHandlerFn(this, 'handleSettingsSave', intervalInput, warnInput, critInput)
				}, _('Save'))
			])
		]);
	},

	handleSettingsSave: function(intervalInput, warnInput, critInput, ev) {
		var values = {
			poll_interval: String(Math.min(3600, Math.max(1, parseInt(intervalInput.value) || 5))),
			warn_temp: String(Math.min(150, Math.max(20, parseInt(warnInput.value) || 60))),
			crit_temp: String(Math.min(150, Math.max(20, parseInt(critInput.value) || 75)))
		};

		return callUciSet('luci_temp', 'settings', values)
			.then(function() { return callUciCommit('luci_temp'); })
			.then(L.bind(function() {
				this.applyConfig(values);
				this.startPoll();
				this.updateView(null);
				ui.hideModal();
			}, this))
			.catch(function(e) {
				ui.hideModal();
				ui.addNotification(null, E('p', _('Failed to save settings: %s').format(e.message || e)), 'error');
			});
	}
});
