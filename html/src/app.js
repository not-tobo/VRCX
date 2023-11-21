// Copyright(c) 2019-2022 pypy, Natsumi and individual contributors.
// All rights reserved.
//
// This work is licensed under the terms of the MIT license.
// For a copy, see <https://opensource.org/licenses/MIT>.

// #region | Imports
import '@fontsource/noto-sans-kr';
import '@fontsource/noto-sans-jp';
import '@fontsource/noto-sans-sc';
import '@fontsource/noto-sans-tc';
import Noty from 'noty';
import Vue from 'vue';
import VueLazyload from 'vue-lazyload';
import VueI18n from 'vue-i18n';
import { DataTables } from 'vue-data-tables';
import ElementUI from 'element-ui';
import * as workerTimers from 'worker-timers';
import VueMarkdown from 'vue-markdown';
import 'default-passive-events';

import configRepository from './repository/config.js';
import webApiService from './service/webapi.js';
import gameLogService from './service/gamelog.js';
import security from './security.js';
import database from './repository/database.js';
import * as localizedStrings from './localization/localizedStrings.js';

// #endregion

speechSynthesis.getVoices();

// #region | Hey look it's most of VRCX!
(async function () {
    var $app = null;

    // #region | Init
    await CefSharp.BindObjectAsync(
        'AppApi',
        'WebApi',
        'SharedVariable',
        'VRCXStorage',
        'SQLite',
        'LogWatcher',
        'Discord',
        'AssetBundleCacher'
    );

    await configRepository.init();

    // #endregion
    // #region | Init: drop/keyup event listeners
    // Make sure file drops outside of the screenshot manager don't navigate to the file path dropped.
    // This issue persists on prompts created with prompt(), unfortunately. Not sure how to fix that.
    document.body.addEventListener('drop', function (e) {
        e.preventDefault();
    });

    document.addEventListener('keyup', function (e) {
        if (e.ctrlKey) {
            if (e.key === 'I') {
                $app.showConsole();
            } else if (e.key === 'r') {
                location.reload();
            }
        } else if (e.altKey && e.key === 'R') {
            $app.refreshCustomCss();
        }

        let carouselNavigation = { ArrowLeft: 0, ArrowRight: 2 }[e.key];
        if (
            typeof carouselNavigation !== 'undefined' &&
            $app.screenshotMetadataDialog?.visible
        ) {
            $app.screenshotMetadataCarouselChange(carouselNavigation);
        }
    });
    // #endregion
    // #region | Init: Define VRCX database helper functions, flush timer

    VRCXStorage.GetArray = async function (key) {
        try {
            var array = JSON.parse(await this.Get(key));
            if (Array.isArray(array)) {
                return array;
            }
        } catch (err) {
            console.error(err);
        }
        return [];
    };

    VRCXStorage.SetArray = function (key, value) {
        this.Set(key, JSON.stringify(value));
    };

    VRCXStorage.GetObject = async function (key) {
        try {
            var object = JSON.parse(await this.Get(key));
            if (object === Object(object)) {
                return object;
            }
        } catch (err) {
            console.error(err);
        }
        return {};
    };

    VRCXStorage.SetObject = function (key, value) {
        this.Set(key, JSON.stringify(value));
    };

    workerTimers.setInterval(
        () => {
            VRCXStorage.Flush();
        },
        5 * 60 * 1000
    );
    // #endregion
    // #region | Init: Noty, Vue, Vue-Markdown, ElementUI, VueI18n, VueLazyLoad, Vue filters, dark stylesheet

    Noty.overrideDefaults({
        animation: {
            open: 'animate__animated animate__bounceInLeft',
            close: 'animate__animated animate__bounceOutLeft'
        },
        layout: 'bottomLeft',
        theme: 'mint',
        timeout: 6000
    });

    Vue.component('vue-markdown', VueMarkdown);

    Vue.use(VueI18n);

    var i18n = new VueI18n({
        locale: 'en',
        fallbackLocale: 'en',
        messages: localizedStrings
    });

    var $t = i18n.t.bind(i18n);

    Vue.use(ElementUI, {
        i18n: (key, value) => i18n.t(key, value)
    });

    var removeFromArray = function (array, item) {
        var { length } = array;
        for (var i = 0; i < length; ++i) {
            if (array[i] === item) {
                array.splice(i, 1);
                return true;
            }
        }
        return false;
    };

    var escapeTag = function (tag) {
        var s = String(tag);
        return s.replace(/["&'<>]/g, (c) => `&#${c.charCodeAt(0)};`);
    };
    Vue.filter('escapeTag', escapeTag);

    var commaNumber = function (num) {
        if (!num) {
            return '0';
        }
        var s = String(Number(num));
        return s.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    };
    Vue.filter('commaNumber', commaNumber);

    var textToHex = function (text) {
        var s = String(text);
        return s
            .split('')
            .map((c) => c.charCodeAt(0).toString(16))
            .join(' ');
    };
    Vue.filter('textToHex', textToHex);

    var timeToText = function (sec) {
        var n = Number(sec);
        if (isNaN(n)) {
            return escapeTag(sec);
        }
        n = Math.floor(n / 1000);
        var arr = [];
        if (n < 0) {
            n = -n;
        }
        if (n >= 86400) {
            arr.push(`${Math.floor(n / 86400)}d`);
            n %= 86400;
        }
        if (n >= 3600) {
            arr.push(`${Math.floor(n / 3600)}h`);
            n %= 3600;
        }
        if (n >= 60) {
            arr.push(`${Math.floor(n / 60)}m`);
            n %= 60;
        }
        if (arr.length === 0 && n < 60) {
            arr.push(`${n}s`);
        }
        return arr.join(' ');
    };
    Vue.filter('timeToText', timeToText);

    Vue.use(VueLazyload, {
        preLoad: 1,
        observer: true,
        observerOptions: {
            rootMargin: '0px',
            threshold: 0.1
        },
        attempt: 3
    });

    Vue.use(DataTables);

    // #endregion
    // #region | Init: Languages

    var subsetOfLanguages = {
        eng: 'English',
        kor: '한국어',
        rus: 'Русский',
        spa: 'Español',
        por: 'Português',
        zho: '中文',
        deu: 'Deutsch',
        jpn: '日本語',
        fra: 'Français',
        swe: 'Svenska',
        nld: 'Nederlands',
        pol: 'Polski',
        dan: 'Dansk',
        nor: 'Norsk',
        ita: 'Italiano',
        tha: 'ภาษาไทย',
        fin: 'Suomi',
        hun: 'Magyar',
        ces: 'Čeština',
        tur: 'Türkçe',
        ara: 'العربية',
        ron: 'Română',
        vie: 'Tiếng Việt',
        ukr: 'украї́нська',
        ase: 'American Sign Language',
        bfi: 'British Sign Language',
        dse: 'Dutch Sign Language',
        fsl: 'French Sign Language',
        jsl: 'Japanese Sign Language',
        kvk: 'Korean Sign Language'
    };

    // vrchat to famfamfam
    var languageMappings = {
        eng: 'us',
        kor: 'kr',
        rus: 'ru',
        spa: 'es',
        por: 'pt',
        zho: 'cn',
        deu: 'de',
        jpn: 'jp',
        fra: 'fr',
        swe: 'se',
        nld: 'nl',
        pol: 'pl',
        dan: 'dk',
        nor: 'no',
        ita: 'it',
        tha: 'th',
        fin: 'fi',
        hun: 'hu',
        ces: 'cz',
        tur: 'tr',
        ara: 'ae',
        ron: 'ro',
        vie: 'vn',
        ukr: 'ua',
        ase: 'us',
        bfi: 'gb',
        dse: 'nl',
        fsl: 'fr',
        jsl: 'jp',
        kvk: 'kr'
    };
    // #endregion
    // #endregion
    // #region | API: This is NOT all the api functions, not even close :(

    // #region | API: Base
    var API = {};

    API.eventHandlers = new Map();

    API.$emit = function (name, ...args) {
        if ($app.debug) {
            console.log(name, ...args);
        }
        var handlers = this.eventHandlers.get(name);
        if (typeof handlers === 'undefined') {
            return;
        }
        try {
            for (var handler of handlers) {
                handler.apply(this, args);
            }
        } catch (err) {
            console.error(err);
        }
    };

    API.$on = function (name, handler) {
        var handlers = this.eventHandlers.get(name);
        if (typeof handlers === 'undefined') {
            handlers = [];
            this.eventHandlers.set(name, handlers);
        }
        handlers.push(handler);
    };

    API.$off = function (name, handler) {
        var handlers = this.eventHandlers.get(name);
        if (typeof handlers === 'undefined') {
            return;
        }
        var { length } = handlers;
        for (var i = 0; i < length; ++i) {
            if (handlers[i] === handler) {
                if (length > 1) {
                    handlers.splice(i, 1);
                } else {
                    this.eventHandlers.delete(name);
                }
                break;
            }
        }
    };

    API.pendingGetRequests = new Map();
    API.failedGetRequests = new Map();
    API.endpointDomainVrchat = 'https://api.vrchat.cloud/api/1';
    API.websocketDomainVrchat = 'wss://pipeline.vrchat.cloud';
    API.endpointDomain = 'https://api.vrchat.cloud/api/1';
    API.websocketDomain = 'wss://pipeline.vrchat.cloud';

    API.call = function (endpoint, options) {
        var init = {
            url: `${API.endpointDomain}/${endpoint}`,
            method: 'GET',
            ...options
        };
        var { params } = init;
        if (init.method === 'GET') {
            // don't retry recent 404/403
            if (this.failedGetRequests.has(endpoint)) {
                var lastRun = this.failedGetRequests.get(endpoint);
                if (lastRun >= Date.now() - 900000) {
                    // 15mins
                    throw new Error(
                        `Bailing request due to recent 404/403, ${endpoint}`
                    );
                }
                this.failedGetRequests.delete(endpoint);
            }
            // transform body to url
            if (params === Object(params)) {
                var url = new URL(init.url);
                var { searchParams } = url;
                for (var key in params) {
                    searchParams.set(key, params[key]);
                }
                init.url = url.toString();
            }
            // merge requests
            var req = this.pendingGetRequests.get(init.url);
            if (typeof req !== 'undefined') {
                if (req.time >= Date.now() - 10000) {
                    // 10s
                    return req.req;
                }
                this.pendingGetRequests.delete(init.url);
            }
        } else if (
            init.uploadImage ||
            init.uploadFilePUT ||
            init.uploadImageLegacy
        ) {
            // nothing
        } else {
            init.headers = {
                'Content-Type': 'application/json;charset=utf-8',
                ...init.headers
            };
            init.body =
                params === Object(params) ? JSON.stringify(params) : '{}';
        }
        var req = webApiService
            .execute(init)
            .catch((err) => {
                this.$throw(0, err);
            })
            .then((response) => {
                try {
                    response.data = JSON.parse(response.data);
                    if ($app.debugWebRequests) {
                        console.log(init, response.data);
                    }
                    return response;
                } catch (e) {}
                if (response.status === 200) {
                    this.$throw(0, 'Invalid JSON response');
                }
                if (
                    response.status === 429 &&
                    init.url.endsWith('/instances/groups')
                ) {
                    $app.nextGroupInstanceRefresh = 120; // 1min
                    throw new Error(
                        `${response.status}: rate limited ${endpoint}`
                    );
                }
                if (response.status === 504 || response.status === 502) {
                    // ignore expected API errors
                    throw new Error(
                        `${response.status}: ${response.data} ${endpoint}`
                    );
                }
                this.$throw(response.status, endpoint);
                return {};
            })
            .then(({ data, status }) => {
                if (status === 200) {
                    if (!data) {
                        return data;
                    }
                    var text = '';
                    if (data.success === Object(data.success)) {
                        text = data.success.message;
                    } else if (data.OK === String(data.OK)) {
                        text = data.OK;
                    }
                    if (text) {
                        new Noty({
                            type: 'success',
                            text: escapeTag(text)
                        }).show();
                    }
                    return data;
                }
                if (
                    status === 401 &&
                    data.error.message === '"Missing Credentials"'
                ) {
                    if (endpoint.substring(0, 9) === 'auth/user') {
                        this.$emit('AUTOLOGIN');
                    }
                    throw new Error('401: Missing Credentials');
                }
                if (status === 403 && endpoint.substring(0, 6) === 'config') {
                    $app.$alert(
                        'VRChat currently blocks most VPNs. Please disable any connected VPNs and try again.',
                        'Login Error 403'
                    );
                    this.logout();
                    throw new Error(`403: ${endpoint}`);
                }
                if (status === 404 && endpoint.substring(0, 8) === 'avatars/') {
                    $app.$message({
                        message: 'Avatar private or deleted',
                        type: 'error'
                    });
                    $app.avatarDialog.visible = false;
                    throw new Error(`404: ${data.error.message} ${endpoint}`);
                }
                if (
                    init.method === 'GET' &&
                    (status === 404 || status === 403) &&
                    !endpoint.startsWith('auth/user')
                ) {
                    this.failedGetRequests.set(endpoint, Date.now());
                }
                if (status === 404 && endpoint.startsWith('users/')) {
                    throw new Error(`404: ${data.error.message} ${endpoint}`);
                }
                if (
                    status === 404 &&
                    endpoint.startsWith('invite/') &&
                    init.inviteId
                ) {
                    this.expireNotification(init.inviteId);
                }
                if (
                    status === 403 &&
                    endpoint.startsWith('invite/myself/to/')
                ) {
                    throw new Error(`403: ${data.error.message} ${endpoint}`);
                }
                if (data && data.error === Object(data.error)) {
                    this.$throw(
                        data.error.status_code || status,
                        data.error.message,
                        endpoint
                    );
                } else if (data && typeof data.error === 'string') {
                    this.$throw(
                        data.status_code || status,
                        data.error,
                        endpoint
                    );
                }
                this.$throw(status, data);
                return data;
            });
        if (init.method === 'GET') {
            req.finally(() => {
                this.pendingGetRequests.delete(init.url);
            });
            this.pendingGetRequests.set(init.url, { req, time: Date.now() });
        }
        return req;
    };

    API.statusCodes = {
        100: 'Continue',
        101: 'Switching Protocols',
        102: 'Processing',
        103: 'Early Hints',
        200: 'OK',
        201: 'Created',
        202: 'Accepted',
        203: 'Non-Authoritative Information',
        204: 'No Content',
        205: 'Reset Content',
        206: 'Partial Content',
        207: 'Multi-Status',
        208: 'Already Reported',
        226: 'IM Used',
        300: 'Multiple Choices',
        301: 'Moved Permanently',
        302: 'Found',
        303: 'See Other',
        304: 'Not Modified',
        305: 'Use Proxy',
        306: 'Switch Proxy',
        307: 'Temporary Redirect',
        308: 'Permanent Redirect',
        400: 'Bad Request',
        401: 'Unauthorized',
        402: 'Payment Required',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        406: 'Not Acceptable',
        407: 'Proxy Authentication Required',
        408: 'Request Timeout',
        409: 'Conflict',
        410: 'Gone',
        411: 'Length Required',
        412: 'Precondition Failed',
        413: 'Payload Too Large',
        414: 'URI Too Long',
        415: 'Unsupported Media Type',
        416: 'Range Not Satisfiable',
        417: 'Expectation Failed',
        418: "I'm a teapot",
        421: 'Misdirected Request',
        422: 'Unprocessable Entity',
        423: 'Locked',
        424: 'Failed Dependency',
        425: 'Too Early',
        426: 'Upgrade Required',
        428: 'Precondition Required',
        429: 'Too Many Requests',
        431: 'Request Header Fields Too Large',
        451: 'Unavailable For Legal Reasons',
        500: 'Internal Server Error',
        501: 'Not Implemented',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout',
        505: 'HTTP Version Not Supported',
        506: 'Variant Also Negotiates',
        507: 'Insufficient Storage',
        508: 'Loop Detected',
        510: 'Not Extended',
        511: 'Network Authentication Required',
        // CloudFlare Error
        520: 'Web server returns an unknown error',
        521: 'Web server is down',
        522: 'Connection timed out',
        523: 'Origin is unreachable',
        524: 'A timeout occurred',
        525: 'SSL handshake failed',
        526: 'Invalid SSL certificate',
        527: 'Railgun Listener to origin error'
    };

    // FIXME : extra를 없애줘
    API.$throw = function (code, error, extra) {
        var text = [];
        if (code > 0) {
            var status = this.statusCodes[code];
            if (typeof status === 'undefined') {
                text.push(`${code}`);
            } else {
                text.push(`${code} ${status}`);
            }
        }
        if (typeof error !== 'undefined') {
            text.push(JSON.stringify(error));
        }
        if (typeof extra !== 'undefined') {
            text.push(JSON.stringify(extra));
        }
        text = text.map((s) => escapeTag(s)).join('<br>');
        if (text.length) {
            if (this.errorNoty) {
                this.errorNoty.close();
            }
            this.errorNoty = new Noty({
                type: 'error',
                text
            }).show();
        }
        throw new Error(text);
    };

    API.$bulk = function (options, args) {
        if ('handle' in options) {
            options.handle.call(this, args, options);
        }
        if (
            args.json.length > 0 &&
            ((options.params.offset += args.json.length),
            // eslint-disable-next-line no-nested-ternary
            options.N > 0
                ? options.N > options.params.offset
                : options.N < 0
                ? args.json.length
                : options.params.n === args.json.length)
        ) {
            this.bulk(options);
        } else if ('done' in options) {
            options.done.call(this, true, options);
        }
        return args;
    };

    API.bulk = function (options) {
        this[options.fn](options.params)
            .catch((err) => {
                if ('done' in options) {
                    options.done.call(this, false, options);
                }
                throw err;
            })
            .then((args) => this.$bulk(options, args));
    };

    // #endregion
    // #region | API: Config

    API.cachedConfig = {};

    API.$on('CONFIG', function (args) {
        args.ref = this.applyConfig(args.json);
    });

    API.applyConfig = function (json) {
        var ref = {
            ...json
        };
        this.cachedConfig = ref;
        return ref;
    };

    API.getConfig = function () {
        return this.call('config', {
            method: 'GET'
        }).then((json) => {
            var args = {
                json
            };
            this.$emit('CONFIG', args);
            return args;
        });
    };

    // #endregion
    // #region | API: Location

    API.parseLocation = function (tag) {
        var _tag = String(tag || '');
        var ctx = {
            tag: _tag,
            isOffline: false,
            isPrivate: false,
            isTraveling: false,
            worldId: '',
            instanceId: '',
            instanceName: '',
            accessType: '',
            accessTypeName: '',
            region: '',
            shortName: '',
            userId: null,
            hiddenId: null,
            privateId: null,
            friendsId: null,
            groupId: null,
            groupAccessType: null,
            canRequestInvite: false,
            strict: false
        };
        if (_tag === 'offline') {
            ctx.isOffline = true;
        } else if (_tag === 'private') {
            ctx.isPrivate = true;
        } else if (_tag === 'traveling') {
            ctx.isTraveling = true;
        } else if (_tag.startsWith('local') === false) {
            var sep = _tag.indexOf(':');
            // technically not part of instance id, but might be there when coping id from url so why not support it
            var shortNameQualifier = '&shortName=';
            var shortNameIndex = _tag.indexOf(shortNameQualifier);
            if (shortNameIndex >= 0) {
                ctx.shortName = _tag.substr(
                    shortNameIndex + shortNameQualifier.length
                );
                _tag = _tag.substr(0, shortNameIndex);
            }
            if (sep >= 0) {
                ctx.worldId = _tag.substr(0, sep);
                ctx.instanceId = _tag.substr(sep + 1);
                ctx.instanceId.split('~').forEach((s, i) => {
                    if (i) {
                        var A = s.indexOf('(');
                        var Z = A >= 0 ? s.lastIndexOf(')') : -1;
                        var key = Z >= 0 ? s.substr(0, A) : s;
                        var value = A < Z ? s.substr(A + 1, Z - A - 1) : '';
                        if (key === 'hidden') {
                            ctx.hiddenId = value;
                        } else if (key === 'private') {
                            ctx.privateId = value;
                        } else if (key === 'friends') {
                            ctx.friendsId = value;
                        } else if (key === 'canRequestInvite') {
                            ctx.canRequestInvite = true;
                        } else if (key === 'region') {
                            ctx.region = value;
                        } else if (key === 'group') {
                            ctx.groupId = value;
                        } else if (key === 'groupAccessType') {
                            ctx.groupAccessType = value;
                        } else if (key === 'strict') {
                            ctx.strict = true;
                        }
                    } else {
                        ctx.instanceName = s;
                    }
                });
                ctx.accessType = 'public';
                if (ctx.privateId !== null) {
                    if (ctx.canRequestInvite) {
                        // InvitePlus
                        ctx.accessType = 'invite+';
                    } else {
                        // InviteOnly
                        ctx.accessType = 'invite';
                    }
                    ctx.userId = ctx.privateId;
                } else if (ctx.friendsId !== null) {
                    // FriendsOnly
                    ctx.accessType = 'friends';
                    ctx.userId = ctx.friendsId;
                } else if (ctx.hiddenId !== null) {
                    // FriendsOfGuests
                    ctx.accessType = 'friends+';
                    ctx.userId = ctx.hiddenId;
                } else if (ctx.groupId !== null) {
                    // Group
                    ctx.accessType = 'group';
                }
                ctx.accessTypeName = ctx.accessType;
                if (ctx.groupAccessType !== null) {
                    if (ctx.groupAccessType === 'public') {
                        ctx.accessTypeName = 'groupPublic';
                    } else if (ctx.groupAccessType === 'plus') {
                        ctx.accessTypeName = 'groupPlus';
                    }
                }
            } else {
                ctx.worldId = _tag;
            }
        }
        return ctx;
    };

    Vue.component('launch', {
        template:
            '<el-button @click="confirm" size="mini" icon="el-icon-info" circle></el-button>',
        props: {
            location: String
        },
        methods: {
            parse() {
                this.$el.style.display = $app.checkCanInviteSelf(this.location)
                    ? ''
                    : 'none';
            },
            confirm() {
                API.$emit('SHOW_LAUNCH_DIALOG', this.location);
            }
        },
        watch: {
            location() {
                this.parse();
            }
        },
        mounted() {
            this.parse();
        }
    });

    Vue.component('invite-yourself', {
        template:
            '<el-button @click="confirm" size="mini" icon="el-icon-message" circle></el-button>',
        props: {
            location: String,
            shortname: String
        },
        methods: {
            parse() {
                this.$el.style.display = $app.checkCanInviteSelf(this.location)
                    ? ''
                    : 'none';
            },
            confirm() {
                $app.selfInvite(this.location, this.shortname);
            }
        },
        watch: {
            location() {
                this.parse();
            }
        },
        mounted() {
            this.parse();
        }
    });

    Vue.component('location', {
        template:
            "<span><span @click=\"showWorldDialog\" :class=\"{ 'x-link': link && this.location !== 'private' && this.location !== 'offline'}\">" +
            '<i v-if="isTraveling" class="el-icon el-icon-loading" style="display:inline-block;margin-right:5px"></i>' +
            '<span>{{ text }}</span></span>' +
            '<span v-if="groupName" @click="showGroupDialog" :class="{ \'x-link\': link}">({{ groupName }})</span>' +
            '<span class="flags" :class="region" style="display:inline-block;margin-left:5px"></span>' +
            '<i v-if="strict" class="el-icon el-icon-lock" style="display:inline-block;margin-left:5px"></i></span>',
        props: {
            location: String,
            traveling: String,
            hint: {
                type: String,
                default: ''
            },
            grouphint: {
                type: String,
                default: ''
            },
            link: {
                type: Boolean,
                default: true
            }
        },
        data() {
            return {
                text: this.location,
                region: this.region,
                strict: this.strict,
                isTraveling: this.isTraveling,
                groupName: this.groupName
            };
        },
        methods: {
            parse() {
                this.isTraveling = false;
                this.groupName = '';
                var instanceId = this.location;
                if (
                    typeof this.traveling !== 'undefined' &&
                    this.location === 'traveling'
                ) {
                    instanceId = this.traveling;
                    this.isTraveling = true;
                }
                this.text = instanceId;
                var L = API.parseLocation(instanceId);
                if (L.isOffline) {
                    this.text = 'Offline';
                } else if (L.isPrivate) {
                    this.text = 'Private';
                } else if (L.isTraveling) {
                    this.text = 'Traveling';
                } else if (typeof this.hint === 'string' && this.hint !== '') {
                    if (L.instanceId) {
                        this.text = `${this.hint} #${L.instanceName} ${L.accessTypeName}`;
                    } else {
                        this.text = this.hint;
                    }
                } else if (L.worldId) {
                    var ref = API.cachedWorlds.get(L.worldId);
                    if (typeof ref === 'undefined') {
                        $app.getWorldName(L.worldId).then((worldName) => {
                            if (L.tag === instanceId) {
                                if (L.instanceId) {
                                    this.text = `${worldName} #${L.instanceName} ${L.accessTypeName}`;
                                } else {
                                    this.text = worldName;
                                }
                            }
                        });
                    } else if (L.instanceId) {
                        this.text = `${ref.name} #${L.instanceName} ${L.accessTypeName}`;
                    } else {
                        this.text = ref.name;
                    }
                }
                if (this.grouphint) {
                    this.groupName = this.grouphint;
                } else if (L.groupId) {
                    this.groupName = L.groupId;
                    $app.getGroupName(instanceId).then((groupName) => {
                        this.groupName = groupName;
                    });
                }
                this.region = '';
                if (!L.isOffline && !L.isPrivate && !L.isTraveling) {
                    this.region = L.region;
                    if (!L.region && L.instanceId) {
                        this.region = 'us';
                    }
                }
                this.strict = L.strict;
            },
            showWorldDialog() {
                if (this.link) {
                    var instanceId = this.location;
                    if (this.traveling && this.location === 'traveling') {
                        instanceId = this.traveling;
                    }
                    if (!instanceId && this.hint.length === 8) {
                        // shortName
                        API.$emit('SHOW_WORLD_DIALOG_SHORTNAME', this.hint);
                        return;
                    }
                    API.$emit('SHOW_WORLD_DIALOG', instanceId);
                }
            },
            showGroupDialog() {
                if (!this.location || !this.link) {
                    return;
                }
                var L = API.parseLocation(this.location);
                if (!L.groupId) {
                    return;
                }
                API.$emit('SHOW_GROUP_DIALOG', L.groupId);
            }
        },
        watch: {
            location() {
                this.parse();
            }
        },
        created() {
            this.parse();
        }
    });

    Vue.component('location-world', {
        template:
            '<span><span @click="showLaunchDialog" class="x-link">' +
            '<i v-if="isUnlocked" class="el-icon el-icon-unlock" style="display:inline-block;margin-right:5px"></i>' +
            '<span>#{{ instanceName }} {{ accessTypeName }}</span></span>' +
            '<span v-if="groupName" @click="showGroupDialog" class="x-link">({{ groupName }})</span>' +
            '<span class="flags" :class="region" style="display:inline-block;margin-left:5px"></span>' +
            '<i v-if="strict" class="el-icon el-icon-lock" style="display:inline-block;margin-left:5px"></i></span>',
        props: {
            locationobject: Object,
            currentuserid: String,
            worlddialogshortname: String,
            grouphint: {
                type: String,
                default: ''
            }
        },
        data() {
            return {
                location: this.location,
                instanceName: this.instanceName,
                accessTypeName: this.accessTypeName,
                region: this.region,
                shortName: this.shortName,
                isUnlocked: this.isUnlocked,
                strict: this.strict,
                groupName: this.groupName
            };
        },
        methods: {
            parse() {
                this.location = this.locationobject.tag;
                this.instanceName = this.locationobject.instanceName;
                this.accessTypeName = this.locationobject.accessTypeName;
                this.strict = this.locationobject.strict;
                this.shortName = this.locationobject.shortName;

                this.isUnlocked = false;
                if (
                    (this.worlddialogshortname &&
                        this.locationobject.shortName &&
                        this.worlddialogshortname ===
                            this.locationobject.shortName) ||
                    this.currentuserid === this.locationobject.userId
                ) {
                    this.isUnlocked = true;
                }

                this.region = this.locationobject.region;
                if (!this.region) {
                    this.region = 'us';
                }

                this.groupName = '';
                if (this.grouphint) {
                    this.groupName = this.grouphint;
                } else if (this.locationobject.groupId) {
                    this.groupName = this.locationobject.groupId;
                    $app.getGroupName(this.locationobject.groupId).then(
                        (groupName) => {
                            this.groupName = groupName;
                        }
                    );
                }
            },
            showLaunchDialog() {
                API.$emit('SHOW_LAUNCH_DIALOG', this.location, this.shortName);
            },
            showGroupDialog() {
                if (!this.location) {
                    return;
                }
                var L = API.parseLocation(this.location);
                if (!L.groupId) {
                    return;
                }
                API.$emit('SHOW_GROUP_DIALOG', L.groupId);
            }
        },
        watch: {
            locationobject() {
                this.parse();
            }
        },
        created() {
            this.parse();
        }
    });

    Vue.component('instance-info', {
        template:
            '<div style="display:inline-block;margin-left:5px">' +
            '<el-tooltip v-if="isValidInstance" placement="bottom">' +
            '<div slot="content">' +
            '<span><span style="color:#409eff">PC: </span>{{ platforms.standalonewindows }}</span></br>' +
            '<span><span style="color:#67c23a">Android: </span>{{ platforms.android }}</span></br>' +
            '<span>{{ $t("dialog.user.info.instance_game_version") }} {{ gameServerVersion }}</span></br>' +
            '<span v-if="queueEnabled">{{ $t("dialog.user.info.instance_queuing_enabled") }}</br></span>' +
            '<span v-if="userList.length">{{ $t("dialog.user.info.instance_users") }}</br></span>' +
            '<span v-for="user in userList" style="cursor:pointer" @click="showUserDialog(user.id)" v-text="user.displayName"></br></span>' +
            '</div>' +
            '<i class="el-icon-caret-bottom"></i>' +
            '</el-tooltip>' +
            '<span v-if="occupants" style="margin-left:5px">{{ occupants }}/{{ capacity }}</span>' +
            '<span v-if="friendcount" style="margin-left:5px">({{ friendcount }})</span>' +
            '<span v-if="isFull" style="margin-left:5px;color:lightcoral">{{ $t("dialog.user.info.instance_full") }}</span>' +
            '<span v-if="queueSize" style="margin-left:5px">{{ $t("dialog.user.info.instance_queue") }} {{ queueSize }}</span>' +
            '</div>',
        props: {
            location: String,
            instance: Object,
            friendcount: Number,
            updateelement: Number
        },
        data() {
            return {
                isValidInstance: this.isValidInstance,
                isFull: this.isFull,
                occupants: this.occupants,
                capacity: this.capacity,
                queueSize: this.queueSize,
                queueEnabled: this.queueEnabled,
                platforms: this.platforms,
                userList: this.userList,
                gameServerVersion: this.gameServerVersion
            };
        },
        methods: {
            parse() {
                this.isValidInstance = false;
                this.isFull = false;
                this.occupants = 0;
                this.capacity = 0;
                this.queueSize = 0;
                this.queueEnabled = false;
                this.platforms = [];
                this.userList = [];
                this.gameServerVersion = '';
                if (
                    !this.location ||
                    !this.instance ||
                    Object.keys(this.instance).length === 0
                ) {
                    return;
                }
                this.isValidInstance = true;
                this.isFull =
                    typeof this.instance.hasCapacityForYou !== 'undefined' &&
                    !this.instance.hasCapacityForYou;
                this.occupants = this.instance.n_users;
                if (this.location === $app.lastLocation.location) {
                    // use gameLog for occupants when in same location
                    this.occupants = $app.lastLocation.playerList.size;
                }
                this.capacity = this.instance.capacity;
                this.gameServerVersion = this.instance.gameServerVersion;
                this.queueSize = this.instance.queueSize;
                if (this.instance.platforms) {
                    this.platforms = this.instance.platforms;
                }
                if (this.instance.users) {
                    this.userList = this.instance.users;
                }
            },
            showUserDialog(userId) {
                API.$emit('SHOW_USER_DIALOG', userId);
            }
        },
        watch: {
            updateelement() {
                this.parse();
            },
            location() {
                this.parse();
            },
            friendcount() {
                this.parse();
            }
        },
        created() {
            this.parse();
        }
    });

    Vue.component('avatar-info', {
        template:
            '<div @click="confirm" class="avatar-info"><span style="margin-right:5px">{{ avatarName }}</span><span :class="color">{{ avatarType }}</span></div>',
        props: {
            imageurl: String,
            userid: String,
            hintownerid: String,
            hintavatarname: String
        },
        data() {
            return {
                avatarName: this.avatarName,
                avatarType: this.avatarType,
                color: this.color
            };
        },
        methods: {
            async parse() {
                this.ownerId = '';
                this.avatarName = '';
                this.avatarType = '';
                this.color = '';
                if (!this.imageurl) {
                    this.avatarName = '-';
                    return;
                } else if (this.hintownerid) {
                    this.avatarName = this.hintavatarname;
                    this.ownerId = this.hintownerid;
                } else {
                    try {
                        var avatarInfo = await $app.getAvatarName(
                            this.imageurl
                        );
                        this.avatarName = avatarInfo.avatarName;
                        this.ownerId = avatarInfo.ownerId;
                    } catch (err) {}
                }
                if (typeof this.userid === 'undefined' || !this.ownerId) {
                    this.color = '';
                    this.avatarType = '';
                } else if (this.ownerId === this.userid) {
                    this.color = 'avatar-info-own';
                    this.avatarType = '(own)';
                } else {
                    this.color = 'avatar-info-public';
                    this.avatarType = '(public)';
                }
            },
            confirm() {
                if (!this.imageurl) {
                    return;
                }
                $app.showAvatarAuthorDialog(
                    this.userid,
                    this.ownerId,
                    this.imageurl
                );
            }
        },
        watch: {
            imageurl() {
                this.parse();
            },
            userid() {
                this.parse();
            }
        },
        mounted() {
            this.parse();
        }
    });

    Vue.component('display-name', {
        template:
            '<span @click="showUserDialog" class="x-link">{{ username }}</span>',
        props: {
            userid: String,
            location: String,
            key: Number
        },
        data() {
            return {
                username: this.username
            };
        },
        methods: {
            async parse() {
                this.username = this.userid;
                if (this.userid) {
                    var args = await API.getCachedUser({ userId: this.userid });
                }
                if (
                    typeof args !== 'undefined' &&
                    typeof args.json !== 'undefined' &&
                    typeof args.json.displayName !== 'undefined'
                ) {
                    this.username = args.json.displayName;
                }
            },
            showUserDialog() {
                $app.showUserDialog(this.userid);
            }
        },
        watch: {
            location() {
                this.parse();
            },
            key() {
                this.parse();
            }
        },
        mounted() {
            this.parse();
        }
    });

    // #endregion
    // #region | API: User

    // changeUserName: PUT users/${userId} {displayName: string, currentPassword: string}
    // changeUserEmail: PUT users/${userId} {email: string, currentPassword: string}
    // changePassword: PUT users/${userId} {password: string, currentPassword: string}
    // updateTOSAggreement: PUT users/${userId} {acceptedTOSVersion: number}

    // 2FA
    // removeTwoFactorAuth: DELETE auth/twofactorauth
    // getTwoFactorAuthpendingSecret: POST auth/twofactorauth/totp/pending -> { qrCodeDataUrl: string, secret: string }
    // verifyTwoFactorAuthPendingSecret: POST auth/twofactorauth/totp/pending/verify { code: string } -> { verified: bool, enabled: bool }
    // cancelVerifyTwoFactorAuthPendingSecret: DELETE auth/twofactorauth/totp/pending
    // getTwoFactorAuthOneTimePasswords: GET auth/user/twofactorauth/otp -> { otp: [ { code: string, used: bool } ] }

    // Account Link
    // merge: PUT auth/user/merge {mergeToken: string}
    // 링크됐다면 CurrentUser에 steamId, oculusId 값이 생기는듯
    // 스팀 계정으로 로그인해도 steamId, steamDetails에 값이 생김

    // Password Recovery
    // sendLink: PUT auth/password {email: string}
    // setNewPassword: PUT auth/password {emailToken: string, id: string, password: string}

    API.isLoggedIn = false;
    API.cachedUsers = new Map();
    API.currentUser = {};
    API.currentTravelers = new Map();

    API.$on('USER:CURRENT', function (args) {
        var { json } = args;
        args.ref = this.applyCurrentUser(json);

        // when isGameRunning use gameLog instead of API
        var $location = this.parseLocation($app.lastLocation.location);
        var $travelingLocation = this.parseLocation(
            $app.lastLocationDestination
        );
        var location = $app.lastLocation.location;
        var instanceId = $location.instanceId;
        var worldId = $location.worldId;
        var travelingToLocation = $app.lastLocationDestination;
        var travelingToWorld = $travelingLocation.worldId;
        var travelingToInstance = $travelingLocation.instanceId;
        if (!$app.isGameRunning && json.presence) {
            if ($app.isRealInstance(json.presence.world)) {
                location = `${json.presence.world}:${json.presence.instance}`;
                travelingToLocation = `${json.presence.travelingToWorld}:${json.presence.travelingToInstance}`;
            } else {
                location = json.presence.world;
                travelingToLocation = json.presence.travelingToWorld;
            }
            instanceId = json.presence.instance;
            worldId = json.presence.world;
            travelingToInstance = json.presence.travelingToInstance;
            travelingToWorld = json.presence.travelingToWorld;
        }

        this.applyUser({
            allowAvatarCopying: json.allowAvatarCopying,
            bio: json.bio,
            bioLinks: json.bioLinks,
            currentAvatarImageUrl: json.currentAvatarImageUrl,
            currentAvatarThumbnailImageUrl: json.currentAvatarThumbnailImageUrl,
            date_joined: json.date_joined,
            developerType: json.developerType,
            displayName: json.displayName,
            friendKey: json.friendKey,
            // json.friendRequestStatus - missing from currentUser
            id: json.id,
            // instanceId - missing from currentUser
            isFriend: json.isFriend,
            last_activity: json.last_activity,
            last_login: json.last_login,
            last_platform: json.last_platform,
            // location - missing from currentUser
            // note - missing from currentUser
            profilePicOverride: json.profilePicOverride,
            state: json.state,
            status: json.status,
            statusDescription: json.statusDescription,
            tags: json.tags,
            // travelingToInstance - missing from currentUser
            // travelingToLocation - missing from currentUser
            // travelingToWorld - missing from currentUser
            userIcon: json.userIcon,
            // worldId - missing from currentUser
            fallbackAvatar: json.fallbackAvatar,

            // Location from gameLog/presence
            location,
            instanceId,
            worldId,
            travelingToLocation,
            travelingToInstance,
            travelingToWorld,

            // set VRCX online/offline timers
            $online_for: this.currentUser.$online_for,
            $offline_for: this.currentUser.$offline_for,
            $location_at: this.currentUser.$location_at,
            $travelingToTime: this.currentUser.$travelingToTime
        });
    });

    API.$on('USER:CURRENT:SAVE', function (args) {
        this.$emit('USER:CURRENT', args);
    });

    API.$on('USER', function (args) {
        if (!args?.json?.displayName) {
            console.error('API.$on(USER) invalid args', args);
            return;
        }
        $app.queueUpdateFriend({ id: args.json.id, state: args.json.state });
        args.ref = this.applyUser(args.json);
    });

    API.$on('USER:LIST', function (args) {
        for (var json of args.json) {
            this.$emit('USER', {
                json,
                params: {
                    userId: json.id
                }
            });
        }
    });

    API.logout = function () {
        this.$emit('LOGOUT');
        webApiService.clearCookies();
        // return this.call('logout', {
        //     method: 'PUT'
        // }).finally(() => {
        //     this.$emit('LOGOUT');
        // });
    };

    /*
        params: {
            username: string,
            password: string
        }
    */
    API.login = function (params) {
        var { username, password, saveCredentials, cipher } = params;
        username = encodeURIComponent(username);
        password = encodeURIComponent(password);
        var auth = btoa(`${username}:${password}`);
        if (saveCredentials) {
            delete params.saveCredentials;
            if (cipher) {
                params.password = cipher;
                delete params.cipher;
            }
            $app.saveCredentials = params;
        }
        return this.call('auth/user', {
            method: 'GET',
            headers: {
                Authorization: `Basic ${auth}`
            }
        }).then((json) => {
            var args = {
                json,
                params,
                origin: true
            };
            if (
                json.requiresTwoFactorAuth &&
                json.requiresTwoFactorAuth.includes('emailOtp')
            ) {
                this.$emit('USER:EMAILOTP', args);
            } else if (json.requiresTwoFactorAuth) {
                this.$emit('USER:2FA', args);
            } else {
                this.$emit('USER:CURRENT', args);
            }
            return args;
        });
    };

    /*
        params: {
            code: string
        }
    */
    API.verifyOTP = function (params) {
        return this.call('auth/twofactorauth/otp/verify', {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('OTP', args);
            return args;
        });
    };

    /*
        params: {
            code: string
        }
    */
    API.verifyTOTP = function (params) {
        return this.call('auth/twofactorauth/totp/verify', {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('TOTP', args);
            return args;
        });
    };

    /*
        params: {
            code: string
        }
    */
    API.verifyEmailOTP = function (params) {
        return this.call('auth/twofactorauth/emailotp/verify', {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('EMAILOTP', args);
            return args;
        });
    };

    API.applyUserTrustLevel = function (ref) {
        ref.$isModerator = ref.developerType && ref.developerType !== 'none';
        ref.$isTroll = false;
        ref.$isProbableTroll = false;
        var trustColor = '';
        var { tags } = ref;
        if (tags.includes('admin_moderator')) {
            ref.$isModerator = true;
        }
        if (tags.includes('system_troll')) {
            ref.$isTroll = true;
        }
        if (tags.includes('system_probable_troll') && !ref.$isTroll) {
            ref.$isProbableTroll = true;
        }
        if (tags.includes('system_trust_veteran')) {
            ref.$trustLevel = 'Trusted User';
            ref.$trustClass = 'x-tag-veteran';
            trustColor = 'veteran';
            ref.$trustSortNum = 5;
        } else if (tags.includes('system_trust_trusted')) {
            ref.$trustLevel = 'Known User';
            ref.$trustClass = 'x-tag-trusted';
            trustColor = 'trusted';
            ref.$trustSortNum = 4;
        } else if (tags.includes('system_trust_known')) {
            ref.$trustLevel = 'User';
            ref.$trustClass = 'x-tag-known';
            trustColor = 'known';
            ref.$trustSortNum = 3;
        } else if (tags.includes('system_trust_basic')) {
            ref.$trustLevel = 'New User';
            ref.$trustClass = 'x-tag-basic';
            trustColor = 'basic';
            ref.$trustSortNum = 2;
        } else {
            ref.$trustLevel = 'Visitor';
            ref.$trustClass = 'x-tag-untrusted';
            trustColor = 'untrusted';
            ref.$trustSortNum = 1;
        }
        if (ref.$isTroll || ref.$isProbableTroll) {
            trustColor = 'troll';
            ref.$trustSortNum += 0.1;
        }
        if (ref.$isModerator) {
            trustColor = 'vip';
            ref.$trustSortNum += 0.3;
        }
        if ($app.randomUserColours && $app.friendLogInitStatus) {
            if (!ref.$userColour) {
                $app.getNameColour(ref.id).then((colour) => {
                    ref.$userColour = colour;
                });
            }
        } else {
            ref.$userColour = $app.trustColor[trustColor];
        }
    };

    // FIXME: it may performance issue. review here
    API.applyUserLanguage = function (ref) {
        ref.$languages = [];
        var { tags } = ref;
        for (var tag of tags) {
            if (tag.startsWith('language_') === false) {
                continue;
            }
            var key = tag.substr(9);
            var value = subsetOfLanguages[key];
            if (typeof value === 'undefined') {
                continue;
            }
            ref.$languages.push({
                key,
                value
            });
        }
    };

    API.applyPresenceLocation = function (ref) {
        var presence = ref.presence;
        if ($app.isRealInstance(presence.world)) {
            ref.$locationTag = `${presence.world}:${presence.instance}`;
        } else {
            ref.$locationTag = presence.world;
        }
        if ($app.isRealInstance(presence.travelingToWorld)) {
            ref.$travelingToLocation = `${presence.travelingToWorld}:${presence.travelingToInstance}`;
        } else {
            ref.$travelingToLocation = presence.travelingToWorld;
        }
        $app.updateCurrentUserLocation();
    };

    API.applyCurrentUser = function (json) {
        var ref = this.currentUser;
        if (this.isLoggedIn) {
            if (json.currentAvatar !== ref.currentAvatar) {
                $app.addAvatarToHistory(json.currentAvatar);
            }
            Object.assign(ref, json);
            if (ref.homeLocation !== ref.$homeLocation.tag) {
                ref.$homeLocation = this.parseLocation(ref.homeLocation);
                // apply home location name to user dialog
                if ($app.userDialog.visible && $app.userDialog.id === ref.id) {
                    $app.getWorldName(API.currentUser.homeLocation).then(
                        (worldName) => {
                            $app.userDialog.$homeLocationName = worldName;
                        }
                    );
                }
            }
            ref.$isVRCPlus = ref.tags.includes('system_supporter');
            this.applyUserTrustLevel(ref);
            this.applyUserLanguage(ref);
            this.applyPresenceLocation(ref);
            // update group list
            if (json.presence?.groups) {
                for (var groupId of json.presence.groups) {
                    if (!this.currentUserGroups.has(groupId)) {
                        $app.onGroupJoined(groupId);
                    }
                }
                for (var groupId of this.currentUserGroups.keys()) {
                    if (!json.presence.groups.includes(groupId)) {
                        $app.onGroupLeft(groupId);
                    }
                }
            }
        } else {
            ref = {
                acceptedPrivacyVersion: 0,
                acceptedTOSVersion: 0,
                accountDeletionDate: null,
                accountDeletionLog: null,
                activeFriends: [],
                allowAvatarCopying: false,
                bio: '',
                bioLinks: [],
                currentAvatar: '',
                currentAvatarAssetUrl: '',
                currentAvatarImageUrl: '',
                currentAvatarThumbnailImageUrl: '',
                date_joined: '',
                developerType: '',
                displayName: '',
                emailVerified: false,
                fallbackAvatar: '',
                friendGroupNames: [],
                friendKey: '',
                friends: [],
                hasBirthday: false,
                hasEmail: false,
                hasLoggedInFromClient: false,
                hasPendingEmail: false,
                homeLocation: '',
                id: '',
                isFriend: false,
                last_activity: '',
                last_login: '',
                last_platform: '',
                obfuscatedEmail: '',
                obfuscatedPendingEmail: '',
                oculusId: '',
                offlineFriends: [],
                onlineFriends: [],
                pastDisplayNames: [],
                presence: {
                    avatarThumbnail: '',
                    displayName: '',
                    groups: [],
                    id: '',
                    instance: '',
                    instanceType: '',
                    platform: '',
                    profilePicOverride: '',
                    status: '',
                    travelingToInstance: '',
                    travelingToWorld: '',
                    world: '',
                    ...json.presence
                },
                profilePicOverride: '',
                state: '',
                status: '',
                statusDescription: '',
                statusFirstTime: false,
                statusHistory: [],
                steamDetails: {},
                steamId: '',
                tags: [],
                twoFactorAuthEnabled: false,
                twoFactorAuthEnabledDate: null,
                unsubscribe: false,
                updated_at: '',
                userIcon: '',
                username: '',
                // VRCX
                $online_for: Date.now(),
                $offline_for: '',
                $location_at: Date.now(),
                $travelingToTime: Date.now(),
                $homeLocation: {},
                $isVRCPlus: false,
                $isModerator: false,
                $isTroll: false,
                $isProbableTroll: false,
                $trustLevel: 'Visitor',
                $trustClass: 'x-tag-untrusted',
                $userColour: '',
                $trustSortNum: 1,
                $languages: [],
                $locationTag: '',
                $travelingToLocation: '',
                ...json
            };
            ref.$homeLocation = this.parseLocation(ref.homeLocation);
            ref.$isVRCPlus = ref.tags.includes('system_supporter');
            this.applyUserTrustLevel(ref);
            this.applyUserLanguage(ref);
            this.applyPresenceLocation(ref);
            this.currentUser = ref;
            this.isLoggedIn = true;
            this.$emit('LOGIN', {
                json,
                ref
            });
        }
        return ref;
    };

    API.getCurrentUser = function () {
        return this.call('auth/user', {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                origin: true
            };
            if (
                json.requiresTwoFactorAuth &&
                json.requiresTwoFactorAuth.includes('emailOtp')
            ) {
                this.$emit('USER:EMAILOTP', args);
            } else if (json.requiresTwoFactorAuth) {
                this.$emit('USER:2FA', args);
            } else {
                this.$emit('USER:CURRENT', args);
            }
            return args;
        });
    };

    var userUpdateQueue = [];
    var userUpdateTimer = null;
    var queueUserUpdate = function (ctx) {
        userUpdateQueue.push(ctx);
        if (userUpdateTimer !== null) {
            return;
        }
        userUpdateTimer = workerTimers.setTimeout(() => {
            userUpdateTimer = null;
            var { length } = userUpdateQueue;
            for (var i = 0; i < length; ++i) {
                API.$emit('USER:UPDATE', userUpdateQueue[i]);
            }
            userUpdateQueue.length = 0;
        }, 1);
    };

    API.applyUser = function (json) {
        var ref = this.cachedUsers.get(json.id);
        if (typeof json.statusDescription !== 'undefined') {
            json.statusDescription = $app.replaceBioSymbols(
                json.statusDescription
            );
            json.statusDescription = $app.removeEmojis(json.statusDescription);
        }
        if (typeof json.bio !== 'undefined') {
            json.bio = $app.replaceBioSymbols(json.bio);
        }
        if (typeof json.note !== 'undefined') {
            json.note = $app.replaceBioSymbols(json.note);
        }
        if (json.currentAvatarImageUrl === $app.robotUrl) {
            delete json.currentAvatarImageUrl;
            delete json.currentAvatarThumbnailImageUrl;
        }
        if (typeof ref === 'undefined') {
            ref = {
                allowAvatarCopying: false,
                bio: '',
                bioLinks: [],
                currentAvatarImageUrl: '',
                currentAvatarThumbnailImageUrl: '',
                date_joined: '',
                developerType: '',
                displayName: '',
                friendKey: '',
                friendRequestStatus: '',
                id: '',
                instanceId: '',
                isFriend: false,
                last_activity: '',
                last_login: '',
                last_platform: '',
                location: '',
                note: '',
                profilePicOverride: '',
                state: '',
                status: '',
                statusDescription: '',
                tags: [],
                travelingToInstance: '',
                travelingToLocation: '',
                travelingToWorld: '',
                userIcon: '',
                worldId: '',
                // only in bulk request
                fallbackAvatar: '',
                // VRCX
                $location: {},
                $location_at: Date.now(),
                $online_for: Date.now(),
                $travelingToTime: Date.now(),
                $offline_for: '',
                $isVRCPlus: false,
                $isModerator: false,
                $isTroll: false,
                $isProbableTroll: false,
                $trustLevel: 'Visitor',
                $trustClass: 'x-tag-untrusted',
                $userColour: '',
                $trustSortNum: 1,
                $languages: [],
                $joinCount: 0,
                $timeSpent: 0,
                $lastSeen: '',
                $nickName: '',
                $previousLocation: '',
                $customTag: '',
                $customTagColour: '',
                //
                ...json
            };
            if ($app.lastLocation.playerList.has(json.displayName)) {
                // update $location_at from instance join time
                var player = $app.lastLocation.playerList.get(json.displayName);
                ref.$location_at = player.joinTime;
                ref.$online_for = player.joinTime;
            }
            if (ref.location === 'traveling') {
                ref.$location = this.parseLocation(ref.travelingToLocation);
                if (!this.currentTravelers.has(ref.id)) {
                    var travelRef = {
                        created_at: new Date().toJSON(),
                        ...ref
                    };
                    this.currentTravelers.set(ref.id, travelRef);
                    $app.sharedFeed.pendingUpdate = true;
                    $app.updateSharedFeed(false);
                    $app.onPlayerTraveling(travelRef);
                }
            } else {
                ref.$location = this.parseLocation(ref.location);
                if (this.currentTravelers.has(ref.id)) {
                    this.currentTravelers.delete(ref.id);
                    $app.sharedFeed.pendingUpdate = true;
                    $app.updateSharedFeed(false);
                }
            }
            if ($app.customUserTags.has(json.id)) {
                var tag = $app.customUserTags.get(json.id);
                ref.$customTag = tag.tag;
                ref.$customTagColour = tag.colour;
            } else if (ref.$customTag) {
                ref.$customTag = '';
                ref.$customTagColour = '';
            }
            ref.$isVRCPlus = ref.tags.includes('system_supporter');
            this.applyUserTrustLevel(ref);
            this.applyUserLanguage(ref);
            this.cachedUsers.set(ref.id, ref);
        } else {
            var props = {};
            for (var prop in ref) {
                if (ref[prop] !== Object(ref[prop])) {
                    props[prop] = true;
                }
            }
            var $ref = { ...ref };
            Object.assign(ref, json);
            ref.$isVRCPlus = ref.tags.includes('system_supporter');
            this.applyUserTrustLevel(ref);
            this.applyUserLanguage(ref);
            // traveling
            if (ref.location === 'traveling') {
                ref.$location = this.parseLocation(ref.travelingToLocation);
                if (!this.currentTravelers.has(ref.id)) {
                    var travelRef = {
                        created_at: new Date().toJSON(),
                        ...ref
                    };
                    this.currentTravelers.set(ref.id, travelRef);
                    $app.sharedFeed.pendingUpdate = true;
                    $app.updateSharedFeed(false);
                    $app.onPlayerTraveling(travelRef);
                }
            } else {
                ref.$location = this.parseLocation(ref.location);
                if (this.currentTravelers.has(ref.id)) {
                    this.currentTravelers.delete(ref.id);
                    $app.sharedFeed.pendingUpdate = true;
                    $app.updateSharedFeed(false);
                }
            }
            for (var prop in ref) {
                if (ref[prop] !== Object(ref[prop])) {
                    props[prop] = true;
                }
            }
            var has = false;
            for (var prop in props) {
                var asis = $ref[prop];
                var tobe = ref[prop];
                if (asis === tobe) {
                    delete props[prop];
                } else {
                    has = true;
                    props[prop] = [tobe, asis];
                }
            }
            // FIXME
            // if the status is offline, just ignore status and statusDescription only.
            if (has && ref.status !== 'offline' && $ref.status !== 'offline') {
                if (props.location && props.location[0] !== 'traveling') {
                    var ts = Date.now();
                    props.location.push(ts - ref.$location_at);
                    ref.$location_at = ts;
                }
                queueUserUpdate({
                    ref,
                    props
                });
                if ($app.debugUserDiff) {
                    delete props.last_login;
                    delete props.last_activity;
                    if (Object.keys(props).length !== 0) {
                        console.log('>', ref.displayName, props);
                    }
                }
            }
        }
        if (ref.id === this.currentUser.id) {
            if (ref.status) {
                this.currentUser.status = ref.status;
            }
            $app.updateCurrentUserLocation();
        }
        this.$emit('USER:APPLY', ref);
        return ref;
    };

    /*
        params: {
            userId: string
        }
    */
    API.getUser = function (params) {
        return this.call(`users/${params.userId}`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('USER', args);
            return args;
        });
    };

    /*
        params: {
            userId: string
        }
    */
    API.getCachedUser = function (params) {
        return new Promise((resolve, reject) => {
            var ref = this.cachedUsers.get(params.userId);
            if (typeof ref === 'undefined') {
                this.getUser(params).catch(reject).then(resolve);
            } else {
                resolve({
                    cache: true,
                    json: ref,
                    params,
                    ref
                });
            }
        });
    };

    /*
        params: {
            n: number,
            offset: number,
            search: string,
            sort: string ('nuisanceFactor', 'created', '_created_at', 'last_login'),
            order: string ('ascending', 'descending')
        }
    */
    API.getUsers = function (params) {
        return this.call('users', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('USER:LIST', args);
            return args;
        });
    };

    /*
        params: {
            status: string ('active', 'offline', 'busy', 'ask me', 'join me'),
            statusDescription: string
        }
    */
    API.saveCurrentUser = function (params) {
        return this.call(`users/${this.currentUser.id}`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('USER:CURRENT:SAVE', args);
            return args;
        });
    };

    /*
        params: {
            tags: array[string]
        }
    */
    API.addUserTags = function (params) {
        return this.call(`users/${this.currentUser.id}/addTags`, {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('USER:CURRENT:SAVE', args);
            return args;
        });
    };

    /*
        params: {
            tags: array[string]
        }
    */
    API.removeUserTags = function (params) {
        return this.call(`users/${this.currentUser.id}/removeTags`, {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('USER:CURRENT:SAVE', args);
            return args;
        });
    };

    /*
        params: {
            userId: string
        }
    */
    API.getUserFeedback = function (params) {
        return this.call(`users/${params.userId}/feedback`, {
            method: 'GET',
            params: {
                n: 100
            }
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('USER:FEEDBACK', args);
            return args;
        });
    };

    // #endregion
    // #region | API: World

    API.cachedWorlds = new Map();

    API.$on('WORLD', function (args) {
        args.ref = this.applyWorld(args.json);
    });

    API.$on('WORLD:LIST', function (args) {
        for (var json of args.json) {
            this.$emit('WORLD', {
                json,
                params: {
                    worldId: json.id
                }
            });
        }
    });

    API.$on('WORLD:DELETE', function (args) {
        var { json } = args;
        this.cachedWorlds.delete(json.id);
        if ($app.worldDialog.ref.authorId === json.authorId) {
            var map = new Map();
            for (var ref of this.cachedWorlds.values()) {
                if (ref.authorId === json.authorId) {
                    map.set(ref.id, ref);
                }
            }
            var array = Array.from(map.values());
            $app.userDialog.worlds = array;
        }
    });

    API.$on('WORLD:SAVE', function (args) {
        var { json } = args;
        this.$emit('WORLD', {
            json,
            params: {
                worldId: json.id
            }
        });
    });

    API.getUserApiCurrentLocation = function () {
        return this.currentUser?.presence?.world;
    };

    API.actuallyGetCurrentLocation = async function () {
        let gameLogLocation = $app.lastLocation.location;
        if (gameLogLocation.startsWith('local')) {
            console.warn('PWI: local test mode', 'test_world');
            return 'test_world';
        }
        if (gameLogLocation === 'traveling') {
            gameLogLocation = $app.lastLocationDestination;
        }

        let presenceLocation = this.currentUser.$locationTag;
        if (presenceLocation === 'traveling') {
            presenceLocation = this.currentUser.$travelingToLocation;
        }

        // We want to use presence if it's valid to avoid extra API calls, but its prone to being outdated when this function is called.
        // So we check if the presence location is the same as the gameLog location; If it is, the presence is (probably) valid and we can use it.
        // If it's not, we need to get the user manually to get the correct location.
        // If the user happens to be offline or the api is just being dumb, we assume that the user logged into VRCX is different than the one in-game and return the gameLog location.
        // This is really dumb.
        if (presenceLocation === gameLogLocation) {
            const L = this.parseLocation(presenceLocation);
            return L.worldId;
        }

        const args = await this.getUser({ userId: this.currentUser.id });
        const user = args.json;
        let userLocation = user.location;
        if (userLocation === 'traveling') {
            userLocation = user.travelingToLocation;
        }
        console.warn(
            "PWI: location didn't match, fetched user location",
            userLocation
        );

        if ($app.isRealInstance(userLocation)) {
            console.warn('PWI: returning user location', userLocation);
            const L = this.parseLocation(userLocation);
            return L.worldId;
        }

        if ($app.isRealInstance(gameLogLocation)) {
            console.warn(`PWI: returning gamelog location: `, gameLogLocation);
            const L = this.parseLocation(gameLogLocation);
            return L.worldId;
        }

        console.error(
            `PWI: all locations invalid: `,
            gameLogLocation,
            userLocation
        );
        return 'test_world';
    };

    API.applyWorld = function (json) {
        var ref = this.cachedWorlds.get(json.id);
        if (typeof ref === 'undefined') {
            ref = {
                id: '',
                name: '',
                description: '',
                authorId: '',
                authorName: '',
                capacity: 0,
                recommendedCapacity: 0,
                tags: [],
                releaseStatus: '',
                imageUrl: '',
                thumbnailImageUrl: '',
                assetUrl: '',
                assetUrlObject: {},
                pluginUrl: '',
                pluginUrlObject: {},
                unityPackageUrl: '',
                unityPackageUrlObject: {},
                unityPackages: [],
                version: 0,
                favorites: 0,
                created_at: '',
                updated_at: '',
                publicationDate: '',
                labsPublicationDate: '',
                visits: 0,
                popularity: 0,
                heat: 0,
                publicOccupants: 0,
                privateOccupants: 0,
                occupants: 0,
                instances: [],
                featured: false,
                organization: '',
                previewYoutubeId: '',
                // VRCX
                $isLabs: false,
                //
                ...json
            };
            this.cachedWorlds.set(ref.id, ref);
        } else {
            Object.assign(ref, json);
        }
        ref.$isLabs = ref.tags.includes('system_labs');
        ref.name = $app.replaceBioSymbols(ref.name);
        ref.description = $app.replaceBioSymbols(ref.description);
        return ref;
    };

    /*
        params: {
            worldId: string
        }
    */
    API.getWorld = function (params) {
        return this.call(`worlds/${params.worldId}`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLD', args);
            return args;
        });
    };

    /*
        params: {
            worldId: string
        }
    */
    API.getCachedWorld = function (params) {
        return new Promise((resolve, reject) => {
            var ref = this.cachedWorlds.get(params.worldId);
            if (typeof ref === 'undefined') {
                this.getWorld(params).catch(reject).then(resolve);
            } else {
                resolve({
                    cache: true,
                    json: ref,
                    params,
                    ref
                });
            }
        });
    };

    /*
        params: {
            n: number,
            offset: number,
            search: string,
            userId: string,
            user: string ('me','friend')
            sort: string ('popularity','heat','trust','shuffle','favorites','reportScore','reportCount','publicationDate','labsPublicationDate','created','_created_at','updated','_updated_at','order'),
            order: string ('ascending','descending'),
            releaseStatus: string ('public','private','hidden','all'),
            featured: boolean
        },
        option: string
    */
    API.getWorlds = function (params, option) {
        var endpoint = 'worlds';
        if (typeof option !== 'undefined') {
            endpoint = `worlds/${option}`;
        }
        return this.call(endpoint, {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params,
                option
            };
            this.$emit('WORLD:LIST', args);
            return args;
        });
    };

    /*
        params: {
            worldId: string
        }
    */
    API.deleteWorld = function (params) {
        return this.call(`worlds/${params.worldId}`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLD:DELETE', args);
            return args;
        });
    };

    /*
        params: {
            id: string
        }
    */
    API.saveWorld = function (params) {
        return this.call(`worlds/${params.id}`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLD:SAVE', args);
            return args;
        });
    };

    /*
        params: {
            worldId: string
        }
    */
    API.publishWorld = function (params) {
        return this.call(`worlds/${params.worldId}/publish`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLD:SAVE', args);
            return args;
        });
    };

    /*
        params: {
            worldId: string
        }
    */
    API.unpublishWorld = function (params) {
        return this.call(`worlds/${params.worldId}/publish`, {
            method: 'DELETE',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLD:SAVE', args);
            return args;
        });
    };

    // #endregion
    // #region | API: Instance

    API.cachedInstances = new Map();

    /*
        params: {
            worldId: string,
            instanceId: string
        }
    */
    API.getInstance = function (params) {
        return this.call(`instances/${params.worldId}:${params.instanceId}`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('INSTANCE', args);
            return args;
        });
    };

    /*
        params: {
            worldId: string,
            type: string,
            region: string,
            ownerId: string,
            roleIds: string[],
            groupAccessType: string,
            queueEnabled: boolean
        }
    */
    API.createInstance = function (params) {
        return this.call('instances', {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('INSTANCE', args);
            return args;
        });
    };

    /*
        params: {
            worldId: string,
            instanceId: string,
            shortName: string
        }
    */
    API.getInstanceShortName = function (instance) {
        var params = {};
        if (instance.shortName) {
            params.shortName = instance.shortName;
        }
        return this.call(
            `instances/${instance.worldId}:${instance.instanceId}/shortName`,
            {
                method: 'GET',
                params
            }
        ).then((json) => {
            var args = {
                json,
                instance,
                params
            };
            this.$emit('INSTANCE:SHORTNAME', args);
            return args;
        });
    };

    /*
        params: {
            shortName: string
        }
    */
    API.getInstanceFromShortName = function (params) {
        return this.call(`instances/s/${params.shortName}`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('INSTANCE', args);
            return args;
        });
    };

    /*
        params: {
            worldId: string,
            instanceId: string,
            shortName: string
        }
    */
    API.selfInvite = function (instance) {
        var params = {};
        if (instance.shortName) {
            params.shortName = instance.shortName;
        }
        return this.call(
            `invite/myself/to/${instance.worldId}:${instance.instanceId}`,
            {
                method: 'POST',
                params
            }
        )
            .then((json) => {
                var args = {
                    json,
                    instance,
                    params
                };
                return args;
            })
            .catch((err) => {
                $app.$message({
                    message: "you're not allowed to access this instance.",
                    type: 'error'
                });
                throw err;
            });
    };

    API.applyInstance = function (json) {
        var ref = this.cachedInstances.get(json.id);
        if (typeof ref === 'undefined') {
            ref = {
                id: '',
                location: '',
                instanceId: '',
                name: '',
                worldId: '',
                type: '',
                ownerId: '',
                tags: [],
                active: false,
                full: false,
                n_users: 0,
                hasCapacityForYou: true, // not present depending on endpoint
                capacity: 0,
                recommendedCapacity: 0,
                userCount: 0, // PC only?
                queueEnabled: false, // only present with group instance type
                queueSize: 0, // only present when queuing is enabled
                platforms: [],
                gameServerVersion: 0,
                secureName: '',
                shortName: '',
                world: {},
                users: [], // only present when you're the owner
                clientNumber: '',
                photonRegion: '',
                region: '',
                canRequestInvite: false,
                permanent: false,
                private: '',
                strict: false,
                // VRCX
                $fetchedAt: '',
                ...json
            };
            this.cachedInstances.set(ref.id, ref);
        } else {
            Object.assign(ref, json);
        }
        ref.$location = this.parseLocation(ref.location);
        if (json.world?.id) {
            this.getCachedWorld({
                worldId: json.world.id
            }).then((args) => {
                ref.world = args.ref;
                return args;
            });
        }
        if (!json.$fetchedAt) {
            ref.$fetchedAt = new Date().toJSON();
        }
        return ref;
    };

    API.$on('INSTANCE', function (args) {
        var { json } = args;
        if (!json) {
            return;
        }
        args.ref = this.applyInstance(args.json);
    });

    API.$on('INSTANCE', function (args) {
        if (!args.json?.id) {
            return;
        }
        if (
            $app.userDialog.visible &&
            $app.userDialog.ref.$location.tag === args.json.id
        ) {
            $app.applyUserDialogLocation();
        }
        if (
            $app.worldDialog.visible &&
            $app.worldDialog.id === args.json.worldId
        ) {
            $app.applyWorldDialogInstances();
        }
        if (
            $app.groupDialog.visible &&
            $app.groupDialog.id === args.json.ownerId
        ) {
            $app.applyGroupDialogInstances();
        }
        // hacky workaround to force update instance info
        $app.updateInstanceInfo++;
    });

    // #endregion
    // #region | API: Friend

    API.$on('FRIEND:LIST', function (args) {
        for (var json of args.json) {
            this.$emit('USER', {
                json,
                params: {
                    userId: json.id
                }
            });
        }
    });

    API.isRefreshFriendsLoading = false;

    API.refreshFriends = async function () {
        this.isRefreshFriendsLoading = true;
        try {
            var onlineFriends = await this.refreshOnlineFriends();
            var offlineFriends = await this.refreshOfflineFriends();
            var friends = onlineFriends.concat(offlineFriends);
            this.isRefreshFriendsLoading = false;
            return friends;
        } catch (err) {
            this.isRefreshFriendsLoading = false;
            throw err;
        }
    };

    API.refreshOnlineFriends = async function () {
        var friends = [];
        var params = {
            n: 50,
            offset: 0,
            offline: false
        };
        var N =
            this.currentUser.onlineFriends.length +
            this.currentUser.activeFriends.length;
        var count = Math.trunc(N / 50);
        for (var i = count; i > -1; i--) {
            if (params.offset > 5000) {
                // API offset limit is 5000
                break;
            }
            for (var j = 0; j < 10; j++) {
                // handle 429 ratelimit error, retry 10 times
                try {
                    var args = await this.getFriends(params);
                    friends = friends.concat(args.json);
                    params.offset += 50;
                    break;
                } catch (err) {
                    console.error(err);
                    if (j === 9) {
                        throw err;
                    }
                    await new Promise((resolve) => {
                        workerTimers.setTimeout(resolve, 5000);
                    });
                }
            }
        }
        return friends;
    };

    API.refreshOfflineFriends = async function () {
        var friends = [];
        var params = {
            n: 50,
            offset: 0,
            offline: true
        };
        var onlineCount =
            this.currentUser.onlineFriends.length +
            this.currentUser.activeFriends.length;
        var N = this.currentUser.friends.length - onlineCount;
        var count = Math.trunc(N / 50);
        for (var i = count; i > -1; i--) {
            if (params.offset > 5000) {
                // API offset limit is 5000
                break;
            }
            for (var j = 0; j < 10; j++) {
                // handle 429 ratelimit error, retry 10 times
                try {
                    var args = await this.getFriends(params);
                    friends = friends.concat(args.json);
                    params.offset += 50;
                    break;
                } catch (err) {
                    console.error(err);
                    if (j === 9) {
                        throw err;
                    }
                    await new Promise((resolve) => {
                        workerTimers.setTimeout(resolve, 5000);
                    });
                }
            }
        }
        return friends;
    };

    /*
        params: {
            n: number,
            offset: number,
            offline: boolean
        }
    */
    API.getFriends = function (params) {
        return this.call('auth/user/friends', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FRIEND:LIST', args);
            return args;
        });
    };

    /*
        params: {
            userId: string
        }
    */
    API.deleteFriend = function (params) {
        return this.call(`auth/user/friends/${params.userId}`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FRIEND:DELETE', args);
            return args;
        });
    };

    /*
        params: {
            userId: string
        }
    */
    API.sendFriendRequest = function (params) {
        return this.call(`user/${params.userId}/friendRequest`, {
            method: 'POST'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FRIEND:REQUEST', args);
            return args;
        });
    };

    /*
        params: {
            userId: string
        }
    */
    API.cancelFriendRequest = function (params) {
        return this.call(`user/${params.userId}/friendRequest`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FRIEND:REQUEST:CANCEL', args);
            return args;
        });
    };

    API.deleteHiddenFriendRequest = function (params, userId) {
        return this.call(`user/${userId}/friendRequest`, {
            method: 'DELETE',
            params
        }).then((json) => {
            var args = {
                json,
                params,
                userId
            };
            this.$emit('NOTIFICATION:HIDE', args);
            return args;
        });
    };

    /*
        params: {
            userId: string
        }
    */
    API.getFriendStatus = function (params) {
        return this.call(`user/${params.userId}/friendStatus`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FRIEND:STATUS', args);
            return args;
        });
    };

    // #endregion
    // #region | API: Avatar

    API.cachedAvatars = new Map();

    API.$on('AVATAR', function (args) {
        args.ref = this.applyAvatar(args.json);
    });

    API.$on('AVATAR:LIST', function (args) {
        for (var json of args.json) {
            this.$emit('AVATAR', {
                json,
                params: {
                    avatarId: json.id
                }
            });
        }
    });

    API.$on('AVATAR:SAVE', function (args) {
        var { json } = args;
        this.$emit('AVATAR', {
            json,
            params: {
                avatarId: json.id
            }
        });
    });

    API.$on('AVATAR:SELECT', function (args) {
        this.$emit('USER:CURRENT', args);
    });

    API.$on('AVATAR:DELETE', function (args) {
        var { json } = args;
        this.cachedAvatars.delete(json._id);
        if ($app.userDialog.id === json.authorId) {
            var map = new Map();
            for (var ref of this.cachedAvatars.values()) {
                if (ref.authorId === json.authorId) {
                    map.set(ref.id, ref);
                }
            }
            var array = Array.from(map.values());
            $app.sortUserDialogAvatars(array);
        }
    });

    API.applyAvatar = function (json) {
        var ref = this.cachedAvatars.get(json.id);
        if (typeof ref === 'undefined') {
            ref = {
                id: '',
                name: '',
                description: '',
                authorId: '',
                authorName: '',
                tags: [],
                assetUrl: '',
                assetUrlObject: {},
                imageUrl: '',
                thumbnailImageUrl: '',
                releaseStatus: '',
                version: 0,
                unityPackages: [],
                unityPackageUrl: '',
                unityPackageUrlObject: {},
                created_at: '',
                updated_at: '',
                featured: false,
                ...json
            };
            this.cachedAvatars.set(ref.id, ref);
        } else {
            var { unityPackages } = ref;
            Object.assign(ref, json);
            if (
                json.unityPackages?.length > 0 &&
                unityPackages.length > 0 &&
                !json.unityPackages[0].assetUrl
            ) {
                ref.unityPackages = unityPackages;
            }
        }
        ref.name = $app.replaceBioSymbols(ref.name);
        ref.description = $app.replaceBioSymbols(ref.description);
        return ref;
    };

    /*
        params: {
            avatarId: string
        }
    */
    API.getAvatar = function (params) {
        return this.call(`avatars/${params.avatarId}`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR', args);
            return args;
        });
    };

    /*
        params: {
            n: number,
            offset: number,
            search: string,
            userId: string,
            user: string ('me','friends')
            sort: string ('created','updated','order','_created_at','_updated_at'),
            order: string ('ascending','descending'),
            releaseStatus: string ('public','private','hidden','all'),
            featured: boolean
        }
    */
    API.getAvatars = function (params) {
        return this.call('avatars', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR:LIST', args);
            return args;
        });
    };

    /*
        params: {
            id: string
            releaseStatus: string ('public','private'),
        }
    */
    API.saveAvatar = function (params) {
        return this.call(`avatars/${params.id}`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR:SAVE', args);
            return args;
        });
    };

    /*
        params: {
            avatarId: string
        }
    */
    API.selectAvatar = function (params) {
        return this.call(`avatars/${params.avatarId}/select`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR:SELECT', args);
            return args;
        });
    };

    /*
        params: {
            avatarId: string
        }
    */
    API.selectFallbackAvatar = function (params) {
        return this.call(`avatars/${params.avatarId}/selectfallback`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR:SELECT', args);
            return args;
        });
    };

    /*
        params: {
            avatarId: string
        }
    */
    API.deleteAvatar = function (params) {
        return this.call(`avatars/${params.avatarId}`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR:DELETE', args);
            return args;
        });
    };

    /*
        params: {
            avatarId: string
        }
    */
    API.createImposter = function (params) {
        return this.call(`avatars/${params.avatarId}/impostor/enqueue`, {
            method: 'POST'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR:IMPOSTER:CREATE', args);
            return args;
        });
    };

    /*
        params: {
            avatarId: string
        }
    */
    API.deleteImposter = function (params) {
        return this.call(`avatars/${params.avatarId}/impostor`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR:IMPOSTER:DELETE', args);
            return args;
        });
    };

    // #endregion
    // #region | API: Notification

    API.isNotificationsLoading = false;

    API.$on('LOGIN', function () {
        this.isNotificationsLoading = false;
    });

    API.$on('NOTIFICATION', function (args) {
        args.ref = this.applyNotification(args.json);
    });

    API.$on('NOTIFICATION:LIST', function (args) {
        for (var json of args.json) {
            this.$emit('NOTIFICATION', {
                json,
                params: {
                    notificationId: json.id
                }
            });
        }
    });

    API.$on('NOTIFICATION:LIST:HIDDEN', function (args) {
        for (var json of args.json) {
            json.type = 'hiddenFriendRequest';
            this.$emit('NOTIFICATION', {
                json,
                params: {
                    notificationId: json.id
                }
            });
        }
    });

    API.$on('NOTIFICATION:ACCEPT', function (args) {
        var array = $app.notificationTable.data;
        for (var i = array.length - 1; i >= 0; i--) {
            if (array[i].id === args.params.notificationId) {
                var ref = array[i];
                break;
            }
        }
        if (typeof ref === 'undefined') {
            return;
        }
        ref.$isExpired = true;
        args.ref = ref;
        this.$emit('NOTIFICATION:EXPIRE', {
            ref,
            params: {
                notificationId: ref.id
            }
        });
        this.$emit('FRIEND:ADD', {
            params: {
                userId: ref.senderUserId
            }
        });
    });

    API.$on('NOTIFICATION:HIDE', function (args) {
        var array = $app.notificationTable.data;
        for (var i = array.length - 1; i >= 0; i--) {
            if (array[i].id === args.params.notificationId) {
                var ref = array[i];
                break;
            }
        }
        if (typeof ref === 'undefined') {
            return;
        }
        args.ref = ref;
        if (
            ref.type === 'friendRequest' ||
            ref.type === 'hiddenFriendRequest' ||
            ref.type.includes('.')
        ) {
            for (var i = array.length - 1; i >= 0; i--) {
                if (array[i].id === ref.id) {
                    array.splice(i, 1);
                    break;
                }
            }
        } else {
            ref.$isExpired = true;
            database.updateNotificationExpired(ref);
        }
        this.$emit('NOTIFICATION:EXPIRE', {
            ref,
            params: {
                notificationId: ref.id
            }
        });
    });

    API.applyNotification = function (json) {
        var array = $app.notificationTable.data;
        for (var i = array.length - 1; i >= 0; i--) {
            if (array[i].id === json.id) {
                var ref = array[i];
                break;
            }
        }
        if (typeof ref === 'undefined') {
            ref = {
                id: '',
                senderUserId: '',
                senderUsername: '',
                type: '',
                message: '',
                details: {},
                seen: false,
                created_at: '',
                // VRCX
                $isExpired: false,
                //
                ...json
            };
        } else {
            Object.assign(ref, json);
            ref.$isExpired = false;
        }
        if (ref.details !== Object(ref.details)) {
            var details = {};
            if (ref.details !== '{}') {
                try {
                    var object = JSON.parse(ref.details);
                    if (object === Object(object)) {
                        details = object;
                    }
                } catch (err) {}
            }
            ref.details = details;
        }
        return ref;
    };

    API.expireFriendRequestNotifications = function () {
        var array = $app.notificationTable.data;
        for (var i = array.length - 1; i >= 0; i--) {
            if (
                array[i].type === 'friendRequest' ||
                array[i].type === 'hiddenFriendRequest' ||
                array[i].type.includes('.')
            ) {
                array.splice(i, 1);
            }
        }
    };

    API.expireNotification = function (notificationId) {
        var array = $app.notificationTable.data;
        for (var i = array.length - 1; i >= 0; i--) {
            if (array[i].id === notificationId) {
                var ref = array[i];
                break;
            }
        }
        if (typeof ref === 'undefined') {
            return;
        }
        ref.$isExpired = true;
        database.updateNotificationExpired(ref);
        this.$emit('NOTIFICATION:EXPIRE', {
            ref,
            params: {
                notificationId: ref.id
            }
        });
    };

    API.refreshNotifications = async function () {
        this.isNotificationsLoading = true;
        try {
            this.expireFriendRequestNotifications();
            var params = {
                n: 100,
                offset: 0
            };
            var count = 50; // 5000 max
            for (var i = 0; i < count; i++) {
                var args = await this.getNotifications(params);
                $app.unseenNotifications = [];
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
            var params = {
                n: 100,
                offset: 0
            };
            var count = 50; // 5000 max
            for (var i = 0; i < count; i++) {
                var args = await this.getNotificationsV2(params);
                $app.unseenNotifications = [];
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
            var params = {
                n: 100,
                offset: 0
            };
            var count = 50; // 5000 max
            for (var i = 0; i < count; i++) {
                var args = await this.getHiddenFriendRequests(params);
                $app.unseenNotifications = [];
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
        } catch (err) {
            console.error(err);
        }
        this.isNotificationsLoading = false;
    };

    /*
        params: {
            n: number,
            offset: number,
            sent: boolean,
            type: string,
            after: string (ISO8601 or 'five_minutes_ago')
        }
    */
    API.getNotifications = function (params) {
        return this.call('auth/user/notifications', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('NOTIFICATION:LIST', args);
            return args;
        });
    };

    API.getHiddenFriendRequests = function (params) {
        return this.call('auth/user/notifications', {
            method: 'GET',
            params: {
                type: 'friendRequest',
                hidden: true,
                ...params
            }
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('NOTIFICATION:LIST:HIDDEN', args);
            return args;
        });
    };

    API.clearNotifications = function () {
        return this.call('auth/user/notifications/clear', {
            method: 'PUT'
        }).then((json) => {
            var args = {
                json
            };
            // FIXME: NOTIFICATION:CLEAR 핸들링
            this.$emit('NOTIFICATION:CLEAR', args);
            return args;
        });
    };

    API.getNotificationsV2 = function (params) {
        return this.call('notifications', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('NOTIFICATION:V2:LIST', args);
            return args;
        });
    };

    API.$on('NOTIFICATION:V2:LIST', function (args) {
        for (var json of args.json) {
            this.$emit('NOTIFICATION:V2', { json });
        }
    });

    API.$on('NOTIFICATION:V2', function (args) {
        var json = args.json;
        json.created_at = json.createdAt;
        this.$emit('NOTIFICATION', {
            json,
            params: {
                notificationId: json.id
            }
        });
    });

    API.$on('NOTIFICATION:V2:UPDATE', function (args) {
        var notificationId = args.params.notificationId;
        var json = args.json;
        if (!json) {
            return;
        }
        json.id = notificationId;
        this.$emit('NOTIFICATION', {
            json,
            params: {
                notificationId
            }
        });
        if (json.seen) {
            this.$emit('NOTIFICATION:SEE', {
                params: {
                    notificationId
                }
            });
        }
    });

    /*
        params: {
            notificationId: string,
            responseType: string,
            responseData: string
        }
    */
    API.sendNotificationResponse = function (params) {
        return this.call(`notifications/${params.notificationId}/respond`, {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('NOTIFICATION:RESPONSE', args);
            return args;
        });
    };

    API.$on('NOTIFICATION:RESPONSE', function (args) {
        this.$emit('NOTIFICATION:HIDE', args);
        new Noty({
            type: 'success',
            text: escapeTag(args.json)
        }).show();
        console.log('NOTIFICATION:RESPONSE', args);
    });

    /*
        params: {
            receiverUserId: string,
            type: string,
            message: string,
            seen: boolean,
            details: json-string
        }
    */
    API.sendInvite = function (params, receiverUserId) {
        return this.call(`invite/${receiverUserId}`, {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params,
                receiverUserId
            };
            this.$emit('NOTIFICATION:INVITE:SEND', args);
            return args;
        });
    };

    API.sendInvitePhoto = function (params, receiverUserId) {
        return this.call(`invite/${receiverUserId}/photo`, {
            uploadImageLegacy: true,
            postData: JSON.stringify(params),
            imageData: $app.uploadImage
        }).then((json) => {
            var args = {
                json,
                params,
                receiverUserId
            };
            this.$emit('NOTIFICATION:INVITE:PHOTO:SEND', args);
            return args;
        });
    };

    API.sendRequestInvite = function (params, receiverUserId) {
        return this.call(`requestInvite/${receiverUserId}`, {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params,
                receiverUserId
            };
            this.$emit('NOTIFICATION:REQUESTINVITE:SEND', args);
            return args;
        });
    };

    API.sendRequestInvitePhoto = function (params, receiverUserId) {
        return this.call(`requestInvite/${receiverUserId}/photo`, {
            uploadImageLegacy: true,
            postData: JSON.stringify(params),
            imageData: $app.uploadImage
        }).then((json) => {
            var args = {
                json,
                params,
                receiverUserId
            };
            this.$emit('NOTIFICATION:REQUESTINVITE:PHOTO:SEND', args);
            return args;
        });
    };

    API.sendInviteResponse = function (params, inviteId) {
        return this.call(`invite/${inviteId}/response`, {
            method: 'POST',
            params,
            inviteId
        }).then((json) => {
            var args = {
                json,
                params,
                inviteId
            };
            this.$emit('INVITE:RESPONSE:SEND', args);
            return args;
        });
    };

    API.sendInviteResponsePhoto = function (params, inviteId) {
        return this.call(`invite/${inviteId}/response/photo`, {
            uploadImageLegacy: true,
            postData: JSON.stringify(params),
            imageData: $app.uploadImage,
            inviteId
        }).then((json) => {
            var args = {
                json,
                params,
                inviteId
            };
            this.$emit('INVITE:RESPONSE:PHOTO:SEND', args);
            return args;
        });
    };

    /*
        params: {
            notificationId: string
        }
    */
    API.acceptNotification = function (params) {
        return this.call(
            `auth/user/notifications/${params.notificationId}/accept`,
            {
                method: 'PUT'
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('NOTIFICATION:ACCEPT', args);
            return args;
        });
    };

    /*
        params: {
            notificationId: string
        }
    */
    API.hideNotification = function (params) {
        return this.call(
            `auth/user/notifications/${params.notificationId}/hide`,
            {
                method: 'PUT'
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('NOTIFICATION:HIDE', args);
            return args;
        });
    };

    API.getFriendRequest = function (userId) {
        var array = $app.notificationTable.data;
        for (var i = array.length - 1; i >= 0; i--) {
            if (
                array[i].type === 'friendRequest' &&
                array[i].senderUserId === userId
            ) {
                return array[i].id;
            }
        }
        return '';
    };

    // #endregion
    // #region | API: PlayerModeration

    API.cachedPlayerModerations = new Map();
    API.isPlayerModerationsLoading = false;

    API.$on('LOGIN', function () {
        this.cachedPlayerModerations.clear();
        this.isPlayerModerationsLoading = false;
        this.refreshPlayerModerations();
    });

    API.$on('PLAYER-MODERATION', function (args) {
        args.ref = this.applyPlayerModeration(args.json);
    });

    API.$on('PLAYER-MODERATION:LIST', function (args) {
        for (var json of args.json) {
            this.$emit('PLAYER-MODERATION', {
                json,
                params: {
                    playerModerationId: json.id
                }
            });
        }
    });

    API.$on('PLAYER-MODERATION:SEND', function (args) {
        var ref = {
            json: args.json,
            params: {
                playerModerationId: args.json.id
            }
        };
        this.$emit('PLAYER-MODERATION', ref);
        this.$emit('PLAYER-MODERATION:@SEND', ref);
    });

    API.$on('PLAYER-MODERATION:DELETE', function (args) {
        var { type, moderated } = args.params;
        var userId = this.currentUser.id;
        for (var ref of this.cachedPlayerModerations.values()) {
            if (
                ref.$isDeleted === false &&
                ref.type === type &&
                ref.targetUserId === moderated &&
                ref.sourceUserId === userId
            ) {
                ref.$isDeleted = true;
                this.$emit('PLAYER-MODERATION:@DELETE', {
                    ref,
                    params: {
                        playerModerationId: ref.id
                    }
                });
            }
        }
    });

    API.applyPlayerModeration = function (json) {
        var ref = this.cachedPlayerModerations.get(json.id);
        if (typeof ref === 'undefined') {
            ref = {
                id: '',
                type: '',
                sourceUserId: '',
                sourceDisplayName: '',
                targetUserId: '',
                targetDisplayName: '',
                created: '',
                // VRCX
                $isDeleted: false,
                $isExpired: false,
                //
                ...json
            };
            this.cachedPlayerModerations.set(ref.id, ref);
        } else {
            Object.assign(ref, json);
            ref.$isExpired = false;
        }
        return ref;
    };

    API.expirePlayerModerations = function () {
        for (var ref of this.cachedPlayerModerations.values()) {
            ref.$isExpired = true;
        }
    };

    API.deleteExpiredPlayerModerations = function () {
        for (var ref of this.cachedPlayerModerations.values()) {
            if (ref.$isDeleted || ref.$isExpired === false) {
                continue;
            }
            ref.$isDeleted = true;
            this.$emit('PLAYER-MODERATION:@DELETE', {
                ref,
                params: {
                    playerModerationId: ref.id
                }
            });
        }
    };

    API.refreshPlayerModerations = function () {
        if (this.isPlayerModerationsLoading) {
            return;
        }
        this.isPlayerModerationsLoading = true;
        this.expirePlayerModerations();
        Promise.all([this.getPlayerModerations(), this.getAvatarModerations()])
            .finally(() => {
                this.isPlayerModerationsLoading = false;
            })
            .then(() => {
                this.deleteExpiredPlayerModerations();
            });
    };

    API.getPlayerModerations = function () {
        return this.call('auth/user/playermoderations', {
            method: 'GET'
        }).then((json) => {
            var args = {
                json
            };
            this.$emit('PLAYER-MODERATION:LIST', args);
            return args;
        });
    };

    /*
        params: {
            moderated: string,
            type: string
        }
    */
    // old-way: POST auth/user/blocks {blocked:userId}
    API.sendPlayerModeration = function (params) {
        return this.call('auth/user/playermoderations', {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('PLAYER-MODERATION:SEND', args);
            return args;
        });
    };

    /*
        params: {
            moderated: string,
            type: string
        }
    */
    // old-way: PUT auth/user/unblocks {blocked:userId}
    API.deletePlayerModeration = function (params) {
        return this.call('auth/user/unplayermoderate', {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('PLAYER-MODERATION:DELETE', args);
            return args;
        });
    };

    // #endregion
    // #region | API: AvatarModeration

    API.cachedAvatarModerations = new Map();

    API.getAvatarModerations = function () {
        return this.call('auth/user/avatarmoderations', {
            method: 'GET'
        }).then((json) => {
            var args = {
                json
            };
            this.$emit('AVATAR-MODERATION:LIST', args);
            return args;
        });
    };

    /*
        params: {
            avatarModerationType: string,
            targetAvatarId: string
        }
    */
    API.sendAvatarModeration = function (params) {
        return this.call('auth/user/avatarmoderations', {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR-MODERATION', args);
            return args;
        });
    };

    /*
        params: {
            avatarModerationType: string,
            targetAvatarId: string
        }
    */
    API.deleteAvatarModeration = function (params) {
        return this.call(
            `auth/user/avatarmoderations?targetAvatarId=${encodeURIComponent(
                params.targetAvatarId
            )}&avatarModerationType=${encodeURIComponent(
                params.avatarModerationType
            )}`,
            {
                method: 'DELETE'
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATAR-MODERATION:DELETE', args);
            return args;
        });
    };

    API.$on('AVATAR-MODERATION', function (args) {
        args.ref = this.applyAvatarModeration(args.json);
    });

    API.$on('AVATAR-MODERATION:LIST', function (args) {
        // TODO: compare with cachedAvatarModerations
        this.cachedAvatarModerations = new Map();
        for (var json of args.json) {
            this.applyAvatarModeration(json);
        }
    });

    API.$on('AVATAR-MODERATION:DELETE', function (args) {
        this.cachedAvatarModerations.delete(args.params.targetAvatarId);

        // update avatar dialog
        var D = $app.avatarDialog;
        if (
            D.visible &&
            args.params.avatarModerationType === 'block' &&
            D.id === args.params.targetAvatarId
        ) {
            D.isBlocked = false;
        }
    });

    API.applyAvatarModeration = function (json) {
        // fix inconsistent Unix time response
        if (typeof json.created === 'number') {
            json.created = new Date(json.created).toJSON();
        }

        var ref = this.cachedAvatarModerations.get(json.targetAvatarId);
        if (typeof ref === 'undefined') {
            ref = {
                avatarModerationType: '',
                created: '',
                targetAvatarId: '',
                ...json
            };
            this.cachedAvatarModerations.set(ref.targetAvatarId, ref);
        } else {
            Object.assign(ref, json);
        }

        // update avatar dialog
        var D = $app.avatarDialog;
        if (
            D.visible &&
            ref.avatarModerationType === 'block' &&
            D.id === ref.targetAvatarId
        ) {
            D.isBlocked = true;
        }

        return ref;
    };

    // #endregion
    // #region | API: Favorite

    API.cachedFavorites = new Map();
    API.cachedFavoritesByObjectId = new Map();
    API.cachedFavoriteGroups = new Map();
    API.cachedFavoriteGroupsByTypeName = new Map();
    API.favoriteFriendGroups = [];
    API.favoriteWorldGroups = [];
    API.favoriteAvatarGroups = [];
    API.isFavoriteLoading = false;
    API.isFavoriteGroupLoading = false;
    API.favoriteLimits = {
        maxFavoriteGroups: {
            avatar: 6,
            friend: 3,
            world: 4
        },
        maxFavoritesPerGroup: {
            avatar: 50,
            friend: 150,
            world: 100
        }
    };

    API.$on('LOGIN', function () {
        this.cachedFavorites.clear();
        this.cachedFavoritesByObjectId.clear();
        this.cachedFavoriteGroups.clear();
        this.cachedFavoriteGroupsByTypeName.clear();
        this.currentUserGroups.clear();
        this.queuedInstances.clear();
        this.favoriteFriendGroups = [];
        this.favoriteWorldGroups = [];
        this.favoriteAvatarGroups = [];
        this.isFavoriteLoading = false;
        this.isFavoriteGroupLoading = false;
        this.refreshFavorites();
    });

    API.$on('FAVORITE', function (args) {
        var ref = this.applyFavorite(args.json);
        if (ref.$isDeleted) {
            return;
        }
        args.ref = ref;
    });

    API.$on('FAVORITE:@DELETE', function (args) {
        var { ref } = args;
        if (ref.$groupRef !== null) {
            --ref.$groupRef.count;
        }
    });

    API.$on('FAVORITE:LIST', function (args) {
        for (var json of args.json) {
            this.$emit('FAVORITE', {
                json,
                params: {
                    favoriteId: json.id
                },
                sortTop: false
            });
        }
    });

    API.$on('FAVORITE:ADD', function (args) {
        this.$emit('FAVORITE', {
            json: args.json,
            params: {
                favoriteId: args.json.id
            },
            sortTop: true
        });
    });

    API.$on('FAVORITE:ADD', function (args) {
        if (
            args.params.type === 'avatar' &&
            !API.cachedAvatars.has(args.params.favoriteId)
        ) {
            this.refreshFavoriteAvatars(args.params.tags);
        }
    });

    API.$on('FAVORITE:DELETE', function (args) {
        var ref = this.cachedFavoritesByObjectId.get(args.params.objectId);
        if (typeof ref === 'undefined') {
            return;
        }
        // 애초에 $isDeleted인데 여기로 올 수 가 있나..?
        this.cachedFavoritesByObjectId.delete(args.params.objectId);
        if (ref.$isDeleted) {
            return;
        }
        args.ref = ref;
        ref.$isDeleted = true;
        API.$emit('FAVORITE:@DELETE', {
            ref,
            params: {
                favoriteId: ref.id
            }
        });
    });

    API.$on('FAVORITE:GROUP', function (args) {
        var ref = this.applyFavoriteGroup(args.json);
        if (ref.$isDeleted) {
            return;
        }
        args.ref = ref;
        if (ref.$groupRef !== null) {
            ref.$groupRef.displayName = ref.displayName;
            ref.$groupRef.visibility = ref.visibility;
        }
    });

    API.$on('FAVORITE:GROUP:LIST', function (args) {
        for (var json of args.json) {
            this.$emit('FAVORITE:GROUP', {
                json,
                params: {
                    favoriteGroupId: json.id
                }
            });
        }
    });

    API.$on('FAVORITE:GROUP:SAVE', function (args) {
        this.$emit('FAVORITE:GROUP', {
            json: args.json,
            params: {
                favoriteGroupId: args.json.id
            }
        });
    });

    API.$on('FAVORITE:GROUP:CLEAR', function (args) {
        var key = `${args.params.type}:${args.params.group}`;
        for (var ref of this.cachedFavorites.values()) {
            if (ref.$isDeleted || ref.$groupKey !== key) {
                continue;
            }
            this.cachedFavoritesByObjectId.delete(ref.favoriteId);
            ref.$isDeleted = true;
            API.$emit('FAVORITE:@DELETE', {
                ref,
                params: {
                    favoriteId: ref.id
                }
            });
        }
    });

    API.$on('FAVORITE:WORLD:LIST', function (args) {
        for (var json of args.json) {
            if (json.id === '???') {
                // FIXME
                // json.favoriteId로 따로 불러와야 하나?
                // 근데 ???가 많으면 과다 요청이 될듯
                continue;
            }
            this.$emit('WORLD', {
                json,
                params: {
                    worldId: json.id
                }
            });
        }
    });

    API.$on('FAVORITE:AVATAR:LIST', function (args) {
        for (var json of args.json) {
            if (json.releaseStatus === 'hidden') {
                // NOTE: 얘는 또 더미 데이터로 옴
                continue;
            }
            this.$emit('AVATAR', {
                json,
                params: {
                    avatarId: json.id
                }
            });
        }
    });

    API.applyFavorite = function (json) {
        var ref = this.cachedFavorites.get(json.id);
        if (typeof ref === 'undefined') {
            ref = {
                id: '',
                type: '',
                favoriteId: '',
                tags: [],
                // VRCX
                $isDeleted: false,
                $isExpired: false,
                $groupKey: '',
                $groupRef: null,
                //
                ...json
            };
            this.cachedFavorites.set(ref.id, ref);
            this.cachedFavoritesByObjectId.set(ref.favoriteId, ref);
        } else {
            Object.assign(ref, json);
            ref.$isExpired = false;
        }
        ref.$groupKey = `${ref.type}:${String(ref.tags[0])}`;
        if (ref.$isDeleted === false && ref.$groupRef === null) {
            var group = this.cachedFavoriteGroupsByTypeName.get(ref.$groupKey);
            if (typeof group !== 'undefined') {
                ref.$groupRef = group;
                ++group.count;
            }
        }
        return ref;
    };

    API.expireFavorites = function () {
        this.cachedFavorites.clear();
        this.cachedFavoritesByObjectId.clear();
        $app.favoriteObjects.clear();
        $app.favoriteFriends_ = [];
        $app.favoriteFriendsSorted = [];
        $app.favoriteWorlds_ = [];
        $app.favoriteWorldsSorted = [];
        $app.favoriteAvatars_ = [];
        $app.favoriteAvatarsSorted = [];
    };

    API.deleteExpiredFavorites = function () {
        for (var ref of this.cachedFavorites.values()) {
            if (ref.$isDeleted || ref.$isExpired === false) {
                continue;
            }
            ref.$isDeleted = true;
            this.$emit('FAVORITE:@DELETE', {
                ref,
                params: {
                    favoriteId: ref.id
                }
            });
        }
    };

    API.refreshFavoriteAvatars = function (tag) {
        var n = Math.floor(Math.random() * (50 + 1)) + 50;
        var params = {
            n,
            offset: 0,
            tag
        };
        this.getFavoriteAvatars(params);
    };

    API.refreshFavoriteItems = function () {
        var types = {
            world: [0, 'getFavoriteWorlds'],
            avatar: [0, 'getFavoriteAvatars']
        };
        var tags = [];
        for (var ref of this.cachedFavorites.values()) {
            if (ref.$isDeleted) {
                continue;
            }
            var type = types[ref.type];
            if (typeof type === 'undefined') {
                continue;
            }
            if (ref.type === 'avatar' && !tags.includes(ref.tags[0])) {
                tags.push(ref.tags[0]);
            }
            ++type[0];
        }
        for (var type in types) {
            var [N, fn] = types[type];
            if (N > 0) {
                if (type === 'avatar') {
                    for (var tag of tags) {
                        var n = Math.floor(Math.random() * (50 + 1)) + 50;
                        this.bulk({
                            fn,
                            N,
                            params: {
                                n,
                                offset: 0,
                                tag
                            }
                        });
                    }
                } else {
                    var n = Math.floor(Math.random() * (36 + 1)) + 64;
                    this.bulk({
                        fn,
                        N,
                        params: {
                            n,
                            offset: 0
                        }
                    });
                }
            }
        }
    };

    API.refreshFavorites = async function () {
        if (this.isFavoriteLoading) {
            return;
        }
        this.isFavoriteLoading = true;
        try {
            await this.getFavoriteLimits();
        } catch (err) {
            console.error(err);
        }
        this.expireFavorites();
        this.bulk({
            fn: 'getFavorites',
            N: -1,
            params: {
                n: 50,
                offset: 0
            },
            done(ok) {
                if (ok) {
                    this.deleteExpiredFavorites();
                }
                this.refreshFavoriteItems();
                this.refreshFavoriteGroups();
                this.isFavoriteLoading = false;
            }
        });
    };

    API.applyFavoriteGroup = function (json) {
        var ref = this.cachedFavoriteGroups.get(json.id);
        if (typeof ref === 'undefined') {
            ref = {
                id: '',
                ownerId: '',
                ownerDisplayName: '',
                name: '',
                displayName: '',
                type: '',
                visibility: '',
                tags: [],
                // VRCX
                $isDeleted: false,
                $isExpired: false,
                $groupRef: null,
                //
                ...json
            };
            this.cachedFavoriteGroups.set(ref.id, ref);
        } else {
            Object.assign(ref, json);
            ref.$isExpired = false;
        }
        return ref;
    };

    API.buildFavoriteGroups = function () {
        // 450 = ['group_0', 'group_1', 'group_2'] x 150
        this.favoriteFriendGroups = [];
        for (var i = 0; i < this.favoriteLimits.maxFavoriteGroups.friend; ++i) {
            this.favoriteFriendGroups.push({
                assign: false,
                key: `friend:group_${i}`,
                type: 'friend',
                name: `group_${i}`,
                displayName: `Group ${i + 1}`,
                capacity: this.favoriteLimits.maxFavoritesPerGroup.friend,
                count: 0,
                visibility: 'private'
            });
        }
        // 400 = ['worlds1', 'worlds2', 'worlds3', 'worlds4'] x 100
        this.favoriteWorldGroups = [];
        for (var i = 0; i < this.favoriteLimits.maxFavoriteGroups.world; ++i) {
            this.favoriteWorldGroups.push({
                assign: false,
                key: `world:worlds${i + 1}`,
                type: 'world',
                name: `worlds${i + 1}`,
                displayName: `Group ${i + 1}`,
                capacity: this.favoriteLimits.maxFavoritesPerGroup.world,
                count: 0,
                visibility: 'private'
            });
        }
        // 350 = ['avatars1', ...] x 50
        // Favorite Avatars (0/50)
        // VRC+ Group 1..5 (0/50)
        this.favoriteAvatarGroups = [];
        for (var i = 0; i < this.favoriteLimits.maxFavoriteGroups.avatar; ++i) {
            this.favoriteAvatarGroups.push({
                assign: false,
                key: `avatar:avatars${i + 1}`,
                type: 'avatar',
                name: `avatars${i + 1}`,
                displayName: `Group ${i + 1}`,
                capacity: this.favoriteLimits.maxFavoritesPerGroup.avatar,
                count: 0,
                visibility: 'private'
            });
        }
        var types = {
            friend: this.favoriteFriendGroups,
            world: this.favoriteWorldGroups,
            avatar: this.favoriteAvatarGroups
        };
        var assigns = new Set();
        // assign the same name first
        for (var ref of this.cachedFavoriteGroups.values()) {
            if (ref.$isDeleted) {
                continue;
            }
            var groups = types[ref.type];
            if (typeof groups === 'undefined') {
                continue;
            }
            for (var group of groups) {
                if (group.assign === false && group.name === ref.name) {
                    group.assign = true;
                    group.displayName = ref.displayName;
                    group.visibility = ref.visibility;
                    ref.$groupRef = group;
                    assigns.add(ref.id);
                    break;
                }
            }
        }
        // assign the rest
        // FIXME
        // The order (cachedFavoriteGroups) is very important. It should be
        // processed in the order in which the server responded. But since we
        // used Map(), the order would be a mess. So we need something to solve
        // this.
        for (var ref of this.cachedFavoriteGroups.values()) {
            if (ref.$isDeleted || assigns.has(ref.id)) {
                continue;
            }
            var groups = types[ref.type];
            if (typeof groups === 'undefined') {
                continue;
            }
            for (var group of groups) {
                if (group.assign === false) {
                    group.assign = true;
                    group.key = `${group.type}:${ref.name}`;
                    group.name = ref.name;
                    group.displayName = ref.displayName;
                    ref.$groupRef = group;
                    assigns.add(ref.id);
                    break;
                }
            }
        }
        // update favorites
        this.cachedFavoriteGroupsByTypeName.clear();
        for (var type in types) {
            for (var group of types[type]) {
                this.cachedFavoriteGroupsByTypeName.set(group.key, group);
            }
        }
        for (var ref of this.cachedFavorites.values()) {
            ref.$groupRef = null;
            if (ref.$isDeleted) {
                continue;
            }
            var group = this.cachedFavoriteGroupsByTypeName.get(ref.$groupKey);
            if (typeof group === 'undefined') {
                continue;
            }
            ref.$groupRef = group;
            ++group.count;
        }
    };

    API.expireFavoriteGroups = function () {
        for (var ref of this.cachedFavoriteGroups.values()) {
            ref.$isExpired = true;
        }
    };

    API.deleteExpiredFavoriteGroups = function () {
        for (var ref of this.cachedFavoriteGroups.values()) {
            if (ref.$isDeleted || ref.$isExpired === false) {
                continue;
            }
            ref.$isDeleted = true;
            this.$emit('FAVORITE:GROUP:@DELETE', {
                ref,
                params: {
                    favoriteGroupId: ref.id
                }
            });
        }
    };

    API.getFavoriteLimits = function () {
        return this.call('auth/user/favoritelimits', {
            method: 'GET'
        }).then((json) => {
            var args = {
                json
            };
            this.$emit('FAVORITE:LIMITS', args);
            return args;
        });
    };

    API.$on('FAVORITE:LIMITS', function (args) {
        this.favoriteLimits = {
            ...this.favoriteLimits,
            ...args.json
        };
    });

    API.refreshFavoriteGroups = function () {
        if (this.isFavoriteGroupLoading) {
            return;
        }
        this.isFavoriteGroupLoading = true;
        this.expireFavoriteGroups();
        this.bulk({
            fn: 'getFavoriteGroups',
            N: -1,
            params: {
                n: 50,
                offset: 0
            },
            done(ok) {
                if (ok) {
                    this.deleteExpiredFavoriteGroups();
                    this.buildFavoriteGroups();
                }
                this.isFavoriteGroupLoading = false;
            }
        });
    };

    /*
        params: {
            n: number,
            offset: number,
            type: string,
            tag: string
        }
    */
    API.getFavorites = function (params) {
        return this.call('favorites', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FAVORITE:LIST', args);
            return args;
        });
    };

    /*
        params: {
            type: string,
            favoriteId: string (objectId),
            tags: string
        }
    */
    API.addFavorite = function (params) {
        return this.call('favorites', {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FAVORITE:ADD', args);
            return args;
        });
    };

    /*
        params: {
            objectId: string
        }
    */
    API.deleteFavorite = function (params) {
        return this.call(`favorites/${params.objectId}`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FAVORITE:DELETE', args);
            return args;
        });
    };

    /*
        params: {
            n: number,
            offset: number,
            type: string
        }
    */
    API.getFavoriteGroups = function (params) {
        return this.call('favorite/groups', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FAVORITE:GROUP:LIST', args);
            return args;
        });
    };

    /*
        params: {
            type: string,
            group: string (name),
            displayName: string,
            visibility: string
        }
    */
    API.saveFavoriteGroup = function (params) {
        return this.call(
            `favorite/group/${params.type}/${params.group}/${this.currentUser.id}`,
            {
                method: 'PUT',
                params
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FAVORITE:GROUP:SAVE', args);
            return args;
        });
    };

    /*
        params: {
            type: string,
            group: string (name)
        }
    */
    API.clearFavoriteGroup = function (params) {
        return this.call(
            `favorite/group/${params.type}/${params.group}/${this.currentUser.id}`,
            {
                method: 'DELETE',
                params
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FAVORITE:GROUP:CLEAR', args);
            return args;
        });
    };

    /*
        params: {
            n: number,
            offset: number
        }
    */
    API.getFavoriteWorlds = function (params) {
        return this.call('worlds/favorites', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FAVORITE:WORLD:LIST', args);
            return args;
        });
    };

    /*
        params: {
            n: number,
            offset: number
        }
    */
    API.getFavoriteAvatars = function (params) {
        return this.call('avatars/favorites', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FAVORITE:AVATAR:LIST', args);
            return args;
        });
    };

    // #endregion
    // #region | API: WebSocket

    API.webSocket = null;
    API.lastWebSocketMessage = '';

    API.$on('LOGOUT', function () {
        this.closeWebSocket();
    });

    API.$on('USER:CURRENT', function () {
        if ($app.friendLogInitStatus && this.webSocket === null) {
            this.getAuth();
        }
    });

    API.$on('AUTH', function (args) {
        if (args.json.ok) {
            this.connectWebSocket(args.json.token);
        }
    });

    API.$on('PIPELINE', function (args) {
        var { type, content, err } = args.json;
        if (typeof err !== 'undefined') {
            console.error('PIPELINE: error', args);
            if (this.errorNoty) {
                this.errorNoty.close();
            }
            this.errorNoty = new Noty({
                type: 'error',
                text: `WebSocket Error: ${err}`
            }).show();
            return;
        }
        if (typeof content === 'undefined') {
            console.error('PIPELINE: missing content', args);
            return;
        }
        if (typeof content.user !== 'undefined') {
            // I forgot about this...
            delete content.user.state;
        }
        switch (type) {
            case 'notification':
                this.$emit('NOTIFICATION', {
                    json: content,
                    params: {
                        notificationId: content.id
                    }
                });
                break;

            case 'notification-v2':
                console.log('notification-v2', content);
                this.$emit('NOTIFICATION:V2', {
                    json: content,
                    params: {
                        notificationId: content.id
                    }
                });
                break;

            case 'notification-v2-delete':
                console.log('notification-v2-delete', content);
                for (var id of content.ids) {
                    this.$emit('NOTIFICATION:HIDE', {
                        params: {
                            notificationId: id
                        }
                    });
                    this.$emit('NOTIFICATION:SEE', {
                        params: {
                            notificationId: id
                        }
                    });
                }
                break;

            case 'notification-v2-update':
                console.log('notification-v2-update', content);
                this.$emit('NOTIFICATION:V2:UPDATE', {
                    json: content.updates,
                    params: {
                        notificationId: content.id
                    }
                });
                break;

            case 'see-notification':
                this.$emit('NOTIFICATION:SEE', {
                    params: {
                        notificationId: content
                    }
                });
                break;

            case 'hide-notification':
                this.$emit('NOTIFICATION:HIDE', {
                    params: {
                        notificationId: content
                    }
                });
                this.$emit('NOTIFICATION:SEE', {
                    params: {
                        notificationId: content
                    }
                });
                break;

            case 'response-notification':
                this.$emit('NOTIFICATION:HIDE', {
                    params: {
                        notificationId: content.notificationId
                    }
                });
                this.$emit('NOTIFICATION:SEE', {
                    params: {
                        notificationId: content.notificationId
                    }
                });
                break;

            case 'friend-add':
                this.$emit('USER', {
                    json: content.user,
                    params: {
                        userId: content.userId
                    }
                });
                this.$emit('FRIEND:ADD', {
                    params: {
                        userId: content.userId
                    }
                });
                break;

            case 'friend-delete':
                this.$emit('FRIEND:DELETE', {
                    params: {
                        userId: content.userId
                    }
                });
                break;

            case 'friend-online':
                if (content?.user?.id) {
                    this.$emit('USER', {
                        json: {
                            location: content.location,
                            travelingToLocation: content.travelingToLocation,
                            ...content.user
                        },
                        params: {
                            userId: content.userId
                        }
                    });
                }
                this.$emit('FRIEND:STATE', {
                    json: {
                        state: 'online'
                    },
                    params: {
                        userId: content.userId
                    }
                });
                break;

            case 'friend-active':
                if (content?.user?.id) {
                    this.$emit('USER', {
                        json: content.user,
                        params: {
                            userId: content.userId
                        }
                    });
                }
                this.$emit('FRIEND:STATE', {
                    json: {
                        state: 'active'
                    },
                    params: {
                        userId: content.userId
                    }
                });
                break;

            case 'friend-offline':
                this.$emit('FRIEND:STATE', {
                    json: {
                        state: 'offline'
                    },
                    params: {
                        userId: content.userId
                    }
                });
                break;

            case 'friend-update':
                // is this used anymore?
                console.error('friend-update', content);
                this.$emit('USER', {
                    json: content.user,
                    params: {
                        userId: content.userId
                    }
                });
                break;

            case 'friend-location':
                if (!content?.user?.id) {
                    var ref = this.cachedUsers.get(content.userId);
                    if (typeof ref !== 'undefined') {
                        this.$emit('USER', {
                            json: {
                                ...ref,
                                location: content.location,
                                travelingToLocation: content.travelingToLocation
                            },
                            params: {
                                userId: content.userId
                            }
                        });
                    }
                    break;
                }
                this.$emit('USER', {
                    json: {
                        location: content.location,
                        travelingToLocation: content.travelingToLocation,
                        ...content.user
                    },
                    params: {
                        userId: content.userId
                    }
                });
                break;

            case 'user-update':
                this.$emit('USER:CURRENT', {
                    json: content.user,
                    params: {
                        userId: content.userId
                    }
                });
                break;

            case 'user-location':
                // update current user location
                if (content.userId !== this.currentUser.id) {
                    console.error('user-location wrong userId', content);
                    break;
                }

                // content.user: {}
                // content.world: {}

                this.currentUser.presence.instance = content.instance;
                this.currentUser.presence.world = content.worldId;
                $app.setCurrentUserLocation(content.location);
                break;

            case 'group-joined':
                var groupId = content.groupId;
                $app.onGroupJoined(groupId);
                break;

            case 'group-left':
                var groupId = content.groupId;
                $app.onGroupLeft(groupId);
                break;

            case 'group-role-updated':
                var groupId = content.role.groupId;
                console.log('group-role-updated', content);

                // content {
                //   role: {
                //     createdAt: string,
                //     description: string,
                //     groupId: string,
                //     id: string,
                //     isManagementRole: boolean,
                //     isSelfAssignable: boolean,
                //     name: string,
                //     order: number,
                //     permissions: string[],
                //     requiresPurchase: boolean,
                //     requiresTwoFactor: boolean
                break;

            case 'group-member-updated':
                var groupId = content.member.groupId;
                $app.onGroupJoined(groupId);
                console.log('group-member-updated', content);

                // content {
                //   groupId: string,
                //   id: string,
                //   isRepresenting: boolean,
                //   isSubscribedToAnnouncements: boolean,
                //   joinedAt: string,
                //   membershipStatus: string,
                //   roleIds: string[],
                //   userId: string,
                //   visibility: string
                // }
                break;

            case 'instance-queue-joined':
            case 'instance-queue-position':
                var instanceId = content.instanceLocation;
                var position = content.position ?? 0;
                var queueSize = content.queueSize ?? 0;
                $app.instanceQueueUpdate(instanceId, position, queueSize);
                break;

            case 'instance-queue-ready':
                var instanceId = content.instanceLocation;
                // var expiry = Date.parse(content.expiry);
                $app.instanceQueueReady(instanceId);
                break;

            case 'content-refresh':
                var contentType = content.contentType;
                if (contentType === 'icon') {
                    if ($app.galleryDialogVisible) {
                        $app.refreshVRCPlusIconsTable();
                    }
                } else if (contentType === 'gallery') {
                    if ($app.galleryDialogVisible) {
                        $app.refreshGalleryTable();
                    }
                } else if (contentType === 'emoji') {
                    if ($app.galleryDialogVisible) {
                        $app.refreshEmojiTable();
                    }
                } else {
                    console.log('Unknown content-refresh', content);
                }
                break;

            default:
                console.log('Unknown pipeline type', args.json);
        }
    });

    API.getAuth = function () {
        return this.call('auth', {
            method: 'GET'
        }).then((json) => {
            var args = {
                json
            };
            this.$emit('AUTH', args);
            return args;
        });
    };

    API.connectWebSocket = function (token) {
        if (this.webSocket === null) {
            var socket = new WebSocket(`${API.websocketDomain}/?auth=${token}`);
            socket.onopen = () => {
                if ($app.debugWebSocket) {
                    console.log('WebSocket connected');
                }
            };
            socket.onclose = () => {
                if (this.webSocket === socket) {
                    this.webSocket = null;
                }
                try {
                    socket.close();
                } catch (err) {}
                if ($app.debugWebSocket) {
                    console.log('WebSocket closed');
                }
            };
            socket.onerror = () => {
                if (this.errorNoty) {
                    this.errorNoty.close();
                }
                this.errorNoty = new Noty({
                    type: 'error',
                    text: 'WebSocket Error'
                }).show();
                socket.onclose();
            };
            socket.onmessage = ({ data }) => {
                try {
                    if (this.lastWebSocketMessage === data) {
                        // pls no spam
                        return;
                    }
                    this.lastWebSocketMessage = data;
                    var json = JSON.parse(data);
                    try {
                        json.content = JSON.parse(json.content);
                    } catch (err) {}
                    this.$emit('PIPELINE', {
                        json
                    });
                    if ($app.debugWebSocket && json.content) {
                        var displayName = '';
                        var user = this.cachedUsers.get(json.content.userId);
                        if (user) {
                            displayName = user.displayName;
                        }
                        console.log(
                            'WebSocket',
                            json.type,
                            displayName,
                            json.content
                        );
                    }
                } catch (err) {
                    console.error(err);
                }
            };
            this.webSocket = socket;
        }
    };

    API.closeWebSocket = function () {
        var socket = this.webSocket;
        if (socket === null) {
            return;
        }
        this.webSocket = null;
        try {
            socket.close();
        } catch (err) {}
    };

    // #endregion
    // #region | API: Visit

    API.getVisits = function () {
        return this.call('visits', {
            method: 'GET'
        }).then((json) => {
            var args = {
                json
            };
            this.$emit('VISITS', args);
            return args;
        });
    };

    // #endregion
    // API

    // #endregion
    // #region | Misc

    var extractFileId = (s) => {
        var match = String(s).match(/file_[0-9A-Za-z-]+/);
        return match ? match[0] : '';
    };

    var extractFileVersion = (s) => {
        var match = /(?:\/file_[0-9A-Za-z-]+\/)([0-9]+)/gi.exec(s);
        return match ? match[1] : '';
    };

    var buildTreeData = (json) => {
        var node = [];
        for (var key in json) {
            if (key[0] === '$') {
                continue;
            }
            var value = json[key];
            if (Array.isArray(value) && value.length === 0) {
                node.push({
                    key,
                    value: '[]'
                });
            } else if (
                value === Object(value) &&
                Object.keys(value).length === 0
            ) {
                node.push({
                    key,
                    value: '{}'
                });
            } else if (Array.isArray(value)) {
                node.push({
                    children: value.map((val, idx) => {
                        if (val === Object(val)) {
                            return {
                                children: buildTreeData(val),
                                key: idx
                            };
                        }
                        return {
                            key: idx,
                            value: val
                        };
                    }),
                    key
                });
            } else if (value === Object(value)) {
                node.push({
                    children: buildTreeData(value),
                    key
                });
            } else {
                node.push({
                    key,
                    value: String(value)
                });
            }
        }
        node.sort(function (a, b) {
            var A = String(a.key).toUpperCase();
            var B = String(b.key).toUpperCase();
            if (A < B) {
                return -1;
            }
            if (A > B) {
                return 1;
            }
            return 0;
        });
        return node;
    };

    var $timers = [];

    Vue.component('timer', {
        template: '<span v-text="text"></span>',
        props: {
            epoch: {
                type: Number,
                default() {
                    return Date.now();
                }
            }
        },
        data() {
            return {
                text: ''
            };
        },
        methods: {
            update() {
                if (!this.epoch) {
                    this.text = '-';
                    return;
                }
                this.text = timeToText(Date.now() - this.epoch);
            }
        },
        watch: {
            date() {
                this.update();
            }
        },
        mounted() {
            $timers.push(this);
            this.update();
        },
        destroyed() {
            removeFromArray($timers, this);
        }
    });

    workerTimers.setInterval(function () {
        for (var $timer of $timers) {
            $timer.update();
        }
    }, 5000);

    // Countdown timer

    var $countDownTimers = [];

    Vue.component('countdown-timer', {
        template: '<span v-text="text"></span>',
        props: {
            datetime: {
                type: String,
                default() {
                    return '';
                }
            },
            hours: {
                type: Number,
                default() {
                    return 1;
                }
            }
        },
        data() {
            return {
                text: ''
            };
        },
        methods: {
            update() {
                var epoch =
                    new Date(this.datetime).getTime() +
                    1000 * 60 * 60 * this.hours -
                    Date.now();
                if (epoch >= 0) {
                    this.text = timeToText(epoch);
                } else {
                    this.text = '-';
                }
            }
        },
        watch: {
            date() {
                this.update();
            }
        },
        mounted() {
            $countDownTimers.push(this);
            this.update();
        },
        destroyed() {
            removeFromArray($countDownTimers, this);
        }
    });

    workerTimers.setInterval(function () {
        for (var $countDownTimer of $countDownTimers) {
            $countDownTimer.update();
        }
    }, 5000);

    // #endregion
    // #region | initialise ... stuff. Don't look at me, I don't work here

    var $app = {
        data: {
            API,
            nextCurrentUserRefresh: 0,
            nextFriendsRefresh: 0,
            nextGroupInstanceRefresh: 0,
            nextAppUpdateCheck: 7200,
            ipcTimeout: 0,
            nextClearVRCXCacheCheck: 0,
            nextDiscordUpdate: 0,
            nextAutoStateChange: 0,
            isDiscordActive: false,
            isGameRunning: false,
            isGameNoVR: true,
            isSteamVRRunning: false,
            isHmdAfk: false,
            appVersion: '',
            latestAppVersion: '',
            ossDialog: false
        },
        i18n,
        computed: {},
        methods: {},
        watch: {},
        el: '#x-app',
        async mounted() {
            await this.changeThemeMode();
            await AppApi.SetUserAgent();
            this.appVersion = await AppApi.GetVersion();
            await this.compareAppVersion();
            await this.setBranch();
            if (this.autoUpdateVRCX !== 'Off') {
                this.checkForVRCXUpdate();
            }
            await AppApi.CheckGameRunning();
            this.isGameNoVR = await configRepository.getBool('isGameNoVR');
            await AppApi.SetAppLauncherSettings(
                this.enableAppLauncher,
                this.enableAppLauncherAutoClose
            );
            API.$on('SHOW_USER_DIALOG', (userId) =>
                this.showUserDialog(userId)
            );
            API.$on('SHOW_WORLD_DIALOG', (tag) => this.showWorldDialog(tag));
            API.$on('SHOW_WORLD_DIALOG_SHORTNAME', (tag) =>
                this.verifyShortName('', tag)
            );
            API.$on('SHOW_GROUP_DIALOG', (groupId) =>
                this.showGroupDialog(groupId)
            );
            API.$on('SHOW_LAUNCH_DIALOG', (tag, shortName) =>
                this.showLaunchDialog(tag, shortName)
            );
            this.updateLoop();
            this.getGameLogTable();
            this.refreshCustomCss();
            this.refreshCustomScript();
            this.checkVRChatDebugLogging();
            this.checkAutoBackupRestoreVrcRegistry();
            await this.migrateStoredUsers();
            this.$nextTick(async function () {
                this.$el.style.display = '';
                if (
                    !this.enablePrimaryPassword &&
                    (await configRepository.getString('lastUserLoggedIn')) !==
                        null
                ) {
                    // login at startup
                    this.loginForm.loading = true;
                    API.getConfig()
                        .catch((err) => {
                            this.loginForm.loading = false;
                            throw err;
                        })
                        .then((args) => {
                            API.getCurrentUser().finally(() => {
                                this.loginForm.loading = false;
                            });
                            return args;
                        });
                } else {
                    this.loginForm.loading = false;
                }
            });
        }
    };

    $app.methods.refreshCustomCss = function () {
        if (document.contains(document.getElementById('app-custom-style'))) {
            document.getElementById('app-custom-style').remove();
        }
        AppApi.CustomCssPath().then((customCss) => {
            var head = document.head;
            if (customCss) {
                var $appCustomStyle = document.createElement('link');
                $appCustomStyle.setAttribute('id', 'app-custom-style');
                $appCustomStyle.rel = 'stylesheet';
                $appCustomStyle.href = `file://${customCss}?_=${Date.now()}`;
                head.appendChild($appCustomStyle);
            }
        });
    };

    $app.methods.refreshCustomScript = function () {
        if (document.contains(document.getElementById('app-custom-script'))) {
            document.getElementById('app-custom-script').remove();
        }
        AppApi.CustomScriptPath().then((customScript) => {
            var head = document.head;
            if (customScript) {
                var $appCustomScript = document.createElement('script');
                $appCustomScript.setAttribute('id', 'app-custom-script');
                $appCustomScript.src = `file://${customScript}?_=${Date.now()}`;
                head.appendChild($appCustomScript);
            }
        });
    };

    $app.methods.openExternalLink = function (link) {
        this.$confirm(`${link}`, 'Open External Link', {
            distinguishCancelAndClose: true,
            confirmButtonText: 'Open',
            cancelButtonText: 'Copy',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    AppApi.OpenLink(link);
                } else if (action === 'cancel') {
                    this.copyLink(link);
                }
            }
        });
    };

    $app.methods.compareAppVersion = async function () {
        if (!this.appVersion) {
            return;
        }
        var lastVersion = await configRepository.getString(
            'VRCX_lastVRCXVersion',
            ''
        );
        if (!lastVersion) {
            await configRepository.setString(
                'VRCX_lastVRCXVersion',
                this.appVersion
            );
            return;
        }
        if (lastVersion !== this.appVersion) {
            await configRepository.setString(
                'VRCX_lastVRCXVersion',
                this.appVersion
            );
            if (
                (await configRepository.getString('VRCX_branch')) === 'Stable'
            ) {
                this.showChangeLogDialog();
            }
        }
    };

    $app.methods.setBranch = async function () {
        if (!this.appVersion) {
            return;
        }
        if (this.appVersion.includes('VRCX Nightly')) {
            this.branch = 'Nightly';
        } else {
            this.branch = 'Stable';
        }
        await configRepository.setString('VRCX_branch', this.branch);
    };

    $app.methods.languageClass = function (language) {
        var style = {};
        var mapping = languageMappings[language];
        if (typeof mapping !== 'undefined') {
            style[mapping] = true;
        }
        return style;
    };

    $app.methods.updateLoop = function () {
        try {
            if (API.isLoggedIn === true) {
                if (--this.nextFriendsRefresh <= 0) {
                    this.nextFriendsRefresh = 7200; // 1hour
                    this.nextCurrentUserRefresh = 60; // 30secs
                    this.refreshFriendsList();
                    this.updateStoredUser(API.currentUser);
                    if (this.isGameRunning) {
                        API.refreshPlayerModerations();
                    }
                }
                if (--this.nextCurrentUserRefresh <= 0) {
                    this.nextCurrentUserRefresh = 60; // 30secs
                    API.getCurrentUser().catch((err1) => {
                        throw err1;
                    });
                    AppApi.CheckGameRunning();
                }
                if (--this.nextGroupInstanceRefresh <= 0) {
                    if (this.friendLogInitStatus) {
                        this.nextGroupInstanceRefresh = 600; // 5min
                        API.getUsersGroupInstances();
                    }
                }
                if (--this.nextAppUpdateCheck <= 0) {
                    if (this.branch === 'Stable') {
                        this.nextAppUpdateCheck = 14400; // 2hours
                    } else {
                        this.nextAppUpdateCheck = 1800; // 15mins
                    }
                    if (this.autoUpdateVRCX !== 'Off') {
                        this.checkForVRCXUpdate();
                    }
                }
                if (--this.ipcTimeout <= 0) {
                    this.ipcEnabled = false;
                }
                if (
                    --this.nextClearVRCXCacheCheck <= 0 &&
                    this.clearVRCXCacheFrequency > 0
                ) {
                    this.nextClearVRCXCacheCheck = this.clearVRCXCacheFrequency;
                    this.clearVRCXCache();
                }
                if (--this.nextDiscordUpdate <= 0) {
                    this.nextDiscordUpdate = 7;
                    if (this.discordActive) {
                        this.updateDiscord();
                    }
                }
                if (--this.nextAutoStateChange <= 0) {
                    this.nextAutoStateChange = 7;
                    this.updateAutoStateChange();
                }
            }
        } catch (err) {
            API.isRefreshFriendsLoading = false;
            console.error(err);
        }
        workerTimers.setTimeout(() => this.updateLoop(), 500);
    };

    $app.methods.updateIsGameRunning = async function (
        isGameRunning,
        isSteamVRRunning,
        isHmdAfk
    ) {
        if (isGameRunning !== this.isGameRunning) {
            this.isGameRunning = isGameRunning;
            if (isGameRunning) {
                API.currentUser.$online_for = Date.now();
                API.currentUser.$offline_for = '';
            } else {
                await configRepository.setBool('isGameNoVR', this.isGameNoVR);
                API.currentUser.$online_for = '';
                API.currentUser.$offline_for = Date.now();
                this.removeAllQueuedInstances();
                this.autoVRChatCacheManagement();
                this.checkIfGameCrashed();
                this.ipcTimeout = 0;
            }
            this.lastLocationReset();
            this.clearNowPlaying();
            this.updateVRLastLocation();
            workerTimers.setTimeout(
                () => this.checkVRChatDebugLogging(),
                60000
            );
            this.nextDiscordUpdate = 0;
            console.log(new Date(), 'isGameRunning', isGameRunning);
        }
        if (isSteamVRRunning !== this.isSteamVRRunning) {
            this.isSteamVRRunning = isSteamVRRunning;
            console.log('isSteamVRRunning:', isSteamVRRunning);
        }
        if (isHmdAfk !== this.isHmdAfk) {
            this.isHmdAfk = isHmdAfk;
            console.log('isHmdAfk:', isHmdAfk);
        }
        this.updateOpenVR();
    };

    $app.data.debug = false;
    $app.data.debugWebRequests = false;
    $app.data.debugWebSocket = false;
    $app.data.debugUserDiff = false;
    $app.data.debugPhotonLogging = false;
    $app.data.debugGameLog = false;
    $app.data.debugFriendState = false;

    $app.data.APILastOnline = new Map();

    $app.data.sharedFeed = {
        gameLog: {
            wrist: [],
            lastEntryDate: ''
        },
        feedTable: {
            wrist: [],
            lastEntryDate: ''
        },
        notificationTable: {
            wrist: [],
            lastEntryDate: ''
        },
        friendLogTable: {
            wrist: [],
            lastEntryDate: ''
        },
        moderationAgainstTable: {
            wrist: [],
            lastEntryDate: ''
        },
        pendingUpdate: false
    };

    $app.data.updateSharedFeedTimer = null;
    $app.data.updateSharedFeedPending = false;
    $app.data.updateSharedFeedPendingForceUpdate = false;
    $app.methods.updateSharedFeed = function (forceUpdate) {
        if (!this.friendLogInitStatus) {
            return;
        }
        if (this.updateSharedFeedTimer) {
            if (forceUpdate) {
                this.updateSharedFeedPendingForceUpdate = true;
            }
            this.updateSharedFeedPending = true;
        } else {
            this.updateSharedExecute(forceUpdate);
            this.updateSharedFeedTimer = setTimeout(() => {
                if (this.updateSharedFeedPending) {
                    this.updateSharedExecute(
                        this.updateSharedFeedPendingForceUpdate
                    );
                }
                this.updateSharedFeedTimer = null;
            }, 150);
        }
    };

    $app.methods.updateSharedExecute = function (forceUpdate) {
        try {
            this.updateSharedFeedDebounce(forceUpdate);
        } catch (err) {
            console.error(err);
        }
        this.updateSharedFeedTimer = null;
        this.updateSharedFeedPending = false;
        this.updateSharedFeedPendingForceUpdate = false;
    };

    $app.methods.updateSharedFeedDebounce = function (forceUpdate) {
        this.updateSharedFeedGameLog(forceUpdate);
        this.updateSharedFeedFeedTable(forceUpdate);
        this.updateSharedFeedNotificationTable(forceUpdate);
        this.updateSharedFeedFriendLogTable(forceUpdate);
        this.updateSharedFeedModerationAgainstTable(forceUpdate);
        var feeds = this.sharedFeed;
        if (!feeds.pendingUpdate) {
            return;
        }
        var wristFeed = [];
        wristFeed = wristFeed.concat(
            feeds.gameLog.wrist,
            feeds.feedTable.wrist,
            feeds.notificationTable.wrist,
            feeds.friendLogTable.wrist,
            feeds.moderationAgainstTable.wrist
        );
        // OnPlayerJoining/Traveling
        API.currentTravelers.forEach((ref) => {
            var isFavorite = API.cachedFavoritesByObjectId.has(ref.id);
            if (
                (this.sharedFeedFilters.wrist.OnPlayerJoining === 'Friends' ||
                    (this.sharedFeedFilters.wrist.OnPlayerJoining === 'VIP' &&
                        isFavorite)) &&
                !$app.lastLocation.playerList.has(ref.displayName)
            ) {
                if (ref.$location.tag === $app.lastLocation.location) {
                    var feedEntry = {
                        ...ref,
                        isFavorite,
                        isFriend: true,
                        type: 'OnPlayerJoining'
                    };
                    wristFeed.unshift(feedEntry);
                } else {
                    var worldRef = API.cachedWorlds.get(ref.$location.worldId);
                    var groupName = '';
                    if (ref.$location.groupId) {
                        var groupRef = API.cachedGroups.get(
                            ref.$location.groupId
                        );
                        if (typeof groupRef !== 'undefined') {
                            groupName = groupRef.name;
                        } else {
                            // no group cache, fetch group and try again
                            API.getGroup({
                                groupId: ref.$location.groupId
                            })
                                .then((args) => {
                                    workerTimers.setTimeout(() => {
                                        // delay to allow for group cache to update
                                        $app.sharedFeed.pendingUpdate = true;
                                        $app.updateSharedFeed(false);
                                    }, 100);
                                    return args;
                                })
                                .catch((err) => {
                                    console.error(err);
                                });
                        }
                    }
                    if (typeof worldRef !== 'undefined') {
                        var feedEntry = {
                            created_at: ref.created_at,
                            type: 'GPS',
                            userId: ref.id,
                            displayName: ref.displayName,
                            location: ref.$location.tag,
                            worldName: worldRef.name,
                            groupName,
                            previousLocation: '',
                            isFavorite,
                            time: 0,
                            isFriend: true,
                            isTraveling: true
                        };
                        wristFeed.unshift(feedEntry);
                    } else {
                        // no world cache, fetch world and try again
                        API.getWorld({
                            worldId: ref.$location.worldId
                        })
                            .then((args) => {
                                workerTimers.setTimeout(() => {
                                    // delay to allow for world cache to update
                                    $app.sharedFeed.pendingUpdate = true;
                                    $app.updateSharedFeed(false);
                                }, 100);
                                return args;
                            })
                            .catch((err) => {
                                console.error(err);
                            });
                    }
                }
            }
        });
        wristFeed.sort(function (a, b) {
            if (a.created_at < b.created_at) {
                return 1;
            }
            if (a.created_at > b.created_at) {
                return -1;
            }
            return 0;
        });
        wristFeed.splice(16);
        AppApi.ExecuteVrFeedFunction(
            'wristFeedUpdate',
            JSON.stringify(wristFeed)
        );
        this.applyUserDialogLocation();
        this.applyWorldDialogInstances();
        this.applyGroupDialogInstances();
        feeds.pendingUpdate = false;
    };

    $app.methods.updateSharedFeedGameLog = function (forceUpdate) {
        // Location, OnPlayerJoined, OnPlayerLeft
        var data = this.gameLogSessionTable;
        var i = data.length;
        if (i > 0) {
            if (
                data[i - 1].created_at ===
                    this.sharedFeed.gameLog.lastEntryDate &&
                forceUpdate === false
            ) {
                return;
            }
            this.sharedFeed.gameLog.lastEntryDate = data[i - 1].created_at;
        } else {
            return;
        }
        var bias = new Date(Date.now() - 86400000).toJSON(); // 24 hours
        var wristArr = [];
        var w = 0;
        var wristFilter = this.sharedFeedFilters.wrist;
        var currentUserLeaveTime = 0;
        var locationJoinTime = 0;
        for (var i = data.length - 1; i > -1; i--) {
            var ctx = data[i];
            if (ctx.created_at < bias) {
                break;
            }
            if (ctx.type === 'Notification') {
                continue;
            }
            // on Location change remove OnPlayerLeft
            if (ctx.type === 'LocationDestination') {
                currentUserLeaveTime = Date.parse(ctx.created_at);
                var currentUserLeaveTimeOffset =
                    currentUserLeaveTime + 5 * 1000;
                for (var k = w - 1; k > -1; k--) {
                    var feedItem = wristArr[k];
                    if (
                        feedItem.type === 'OnPlayerLeft' &&
                        Date.parse(feedItem.created_at) >=
                            currentUserLeaveTime &&
                        Date.parse(feedItem.created_at) <=
                            currentUserLeaveTimeOffset
                    ) {
                        wristArr.splice(k, 1);
                        w--;
                    }
                }
            }
            // on Location change remove OnPlayerJoined
            if (ctx.type === 'Location') {
                locationJoinTime = Date.parse(ctx.created_at);
                var locationJoinTimeOffset = locationJoinTime + 20 * 1000;
                for (var k = w - 1; k > -1; k--) {
                    var feedItem = wristArr[k];
                    if (
                        feedItem.type === 'OnPlayerJoined' &&
                        Date.parse(feedItem.created_at) >= locationJoinTime &&
                        Date.parse(feedItem.created_at) <=
                            locationJoinTimeOffset
                    ) {
                        wristArr.splice(k, 1);
                        w--;
                    }
                }
            }
            // remove current user
            if (
                (ctx.type === 'OnPlayerJoined' ||
                    ctx.type === 'OnPlayerLeft' ||
                    ctx.type === 'PortalSpawn') &&
                ctx.displayName === API.currentUser.displayName
            ) {
                continue;
            }
            var isFriend = false;
            var isFavorite = false;
            if (ctx.userId) {
                isFriend = this.friends.has(ctx.userId);
                isFavorite = API.cachedFavoritesByObjectId.has(ctx.userId);
            } else if (ctx.displayName) {
                for (var ref of API.cachedUsers.values()) {
                    if (ref.displayName === ctx.displayName) {
                        isFriend = this.friends.has(ref.id);
                        isFavorite = API.cachedFavoritesByObjectId.has(ref.id);
                        break;
                    }
                }
            }
            // add tag colour
            var tagColour = '';
            if (ctx.userId) {
                var tagRef = this.customUserTags.get(ctx.userId);
                if (typeof tagRef !== 'undefined') {
                    tagColour = tagRef.colour;
                }
            }
            // BlockedOnPlayerJoined, BlockedOnPlayerLeft, MutedOnPlayerJoined, MutedOnPlayerLeft
            if (ctx.type === 'OnPlayerJoined' || ctx.type === 'OnPlayerLeft') {
                for (var ref of this.playerModerationTable.data) {
                    if (ref.targetDisplayName === ctx.displayName) {
                        if (ref.type === 'block') {
                            var type = `Blocked${ctx.type}`;
                        } else if (ref.type === 'mute') {
                            var type = `Muted${ctx.type}`;
                        } else {
                            continue;
                        }
                        var entry = {
                            created_at: ctx.created_at,
                            type,
                            displayName: ref.targetDisplayName,
                            userId: ref.targetUserId,
                            isFriend,
                            isFavorite
                        };
                        if (
                            wristFilter[type] &&
                            (wristFilter[type] === 'Everyone' ||
                                (wristFilter[type] === 'Friends' && isFriend) ||
                                (wristFilter[type] === 'VIP' && isFavorite))
                        ) {
                            wristArr.unshift(entry);
                        }
                        this.queueFeedNoty(entry);
                    }
                }
            }
            // when too many user joins happen at once when switching instances
            // the "w" counter maxes out and wont add any more entries
            // until the onJoins are cleared by "Location"
            // e.g. if a "VideoPlay" occurs between "OnPlayerJoined" and "Location" it wont be added
            if (
                w < 50 &&
                wristFilter[ctx.type] &&
                (wristFilter[ctx.type] === 'On' ||
                    wristFilter[ctx.type] === 'Everyone' ||
                    (wristFilter[ctx.type] === 'Friends' && isFriend) ||
                    (wristFilter[ctx.type] === 'VIP' && isFavorite))
            ) {
                wristArr.push({
                    ...ctx,
                    tagColour,
                    isFriend,
                    isFavorite
                });
                ++w;
            }
        }
        this.sharedFeed.gameLog.wrist = wristArr;
        this.sharedFeed.pendingUpdate = true;
    };

    $app.methods.queueGameLogNoty = function (noty) {
        // remove join/leave notifications when switching worlds
        if (noty.type === 'OnPlayerJoined') {
            var bias = this.lastLocation.date + 30 * 1000; // 30 secs
            if (Date.parse(noty.created_at) <= bias) {
                return;
            }
        }
        if (noty.type === 'OnPlayerLeft') {
            var bias = this.lastLocationDestinationTime + 5 * 1000; // 5 secs
            if (Date.parse(noty.created_at) <= bias) {
                return;
            }
        }
        if (
            noty.type === 'Notification' ||
            noty.type === 'LocationDestination'
            // skip unused entries
        ) {
            return;
        }
        if (noty.type === 'VideoPlay') {
            if (!noty.videoName) {
                // skip video without name
                return;
            }
            noty.notyName = noty.videoName;
            if (noty.displayName) {
                // add requester's name to noty
                noty.notyName = `${noty.videoName} (${noty.displayName})`;
            }
        }
        if (
            noty.type !== 'VideoPlay' &&
            noty.displayName === API.currentUser.displayName
        ) {
            // remove current user
            return;
        }
        noty.isFriend = false;
        noty.isFavorite = false;
        if (noty.userId) {
            noty.isFriend = this.friends.has(noty.userId);
            noty.isFavorite = API.cachedFavoritesByObjectId.has(noty.userId);
        } else if (noty.displayName) {
            for (var ref of API.cachedUsers.values()) {
                if (ref.displayName === noty.displayName) {
                    noty.isFriend = this.friends.has(ref.id);
                    noty.isFavorite = API.cachedFavoritesByObjectId.has(ref.id);
                    break;
                }
            }
        }
        var notyFilter = this.sharedFeedFilters.noty;
        if (
            notyFilter[noty.type] &&
            (notyFilter[noty.type] === 'On' ||
                notyFilter[noty.type] === 'Everyone' ||
                (notyFilter[noty.type] === 'Friends' && noty.isFriend) ||
                (notyFilter[noty.type] === 'VIP' && noty.isFavorite))
        ) {
            this.playNoty(noty);
        }
    };

    $app.methods.updateSharedFeedFeedTable = function (forceUpdate) {
        // GPS, Online, Offline, Status, Avatar
        var data = this.feedSessionTable;
        var i = data.length;
        if (i > 0) {
            if (
                data[i - 1].created_at ===
                    this.sharedFeed.feedTable.lastEntryDate &&
                forceUpdate === false
            ) {
                return;
            }
            this.sharedFeed.feedTable.lastEntryDate = data[i - 1].created_at;
        } else {
            return;
        }
        var bias = new Date(Date.now() - 86400000).toJSON(); // 24 hours
        var wristArr = [];
        var w = 0;
        var wristFilter = this.sharedFeedFilters.wrist;
        for (var i = data.length - 1; i > -1; i--) {
            var ctx = data[i];
            if (ctx.created_at < bias) {
                break;
            }
            if (ctx.type === 'Avatar') {
                continue;
            }
            // hide private worlds from feed
            if (
                this.hidePrivateFromFeed &&
                ctx.type === 'GPS' &&
                ctx.location === 'private'
            ) {
                continue;
            }
            var isFriend = this.friends.has(ctx.userId);
            var isFavorite = API.cachedFavoritesByObjectId.has(ctx.userId);
            if (
                w < 20 &&
                wristFilter[ctx.type] &&
                (wristFilter[ctx.type] === 'Friends' ||
                    (wristFilter[ctx.type] === 'VIP' && isFavorite))
            ) {
                wristArr.push({
                    ...ctx,
                    isFriend,
                    isFavorite
                });
                ++w;
            }
        }
        this.sharedFeed.feedTable.wrist = wristArr;
        this.sharedFeed.pendingUpdate = true;
    };

    $app.methods.queueFeedNoty = function (noty) {
        if (noty.type === 'Avatar') {
            return;
        }
        // hide private worlds from feed
        if (
            this.hidePrivateFromFeed &&
            noty.type === 'GPS' &&
            noty.location === 'private'
        ) {
            return;
        }
        noty.isFriend = this.friends.has(noty.userId);
        noty.isFavorite = API.cachedFavoritesByObjectId.has(noty.userId);
        var notyFilter = this.sharedFeedFilters.noty;
        if (
            notyFilter[noty.type] &&
            (notyFilter[noty.type] === 'Friends' ||
                (notyFilter[noty.type] === 'VIP' && noty.isFavorite))
        ) {
            this.playNoty(noty);
        }
    };

    $app.methods.updateSharedFeedNotificationTable = function (forceUpdate) {
        // invite, requestInvite, requestInviteResponse, inviteResponse, friendRequest
        var { data } = this.notificationTable;
        var i = data.length;
        if (i > 0) {
            if (
                data[i - 1].created_at ===
                    this.sharedFeed.notificationTable.lastEntryDate &&
                forceUpdate === false
            ) {
                return;
            }
            this.sharedFeed.notificationTable.lastEntryDate =
                data[i - 1].created_at;
        } else {
            return;
        }
        var bias = new Date(Date.now() - 86400000).toJSON(); // 24 hours
        var wristArr = [];
        var w = 0;
        var wristFilter = this.sharedFeedFilters.wrist;
        for (var i = data.length - 1; i > -1; i--) {
            var ctx = data[i];
            if (ctx.created_at < bias) {
                break;
            }
            if (ctx.senderUserId === API.currentUser.id) {
                continue;
            }
            var isFriend = this.friends.has(ctx.senderUserId);
            var isFavorite = API.cachedFavoritesByObjectId.has(
                ctx.senderUserId
            );
            if (
                w < 20 &&
                wristFilter[ctx.type] &&
                (wristFilter[ctx.type] === 'On' ||
                    wristFilter[ctx.type] === 'Friends' ||
                    (wristFilter[ctx.type] === 'VIP' && isFavorite))
            ) {
                wristArr.push({
                    ...ctx,
                    isFriend,
                    isFavorite
                });
                ++w;
            }
        }
        this.sharedFeed.notificationTable.wrist = wristArr;
        this.sharedFeed.pendingUpdate = true;
    };

    $app.methods.queueNotificationNoty = function (noty) {
        noty.isFriend = this.friends.has(noty.senderUserId);
        noty.isFavorite = API.cachedFavoritesByObjectId.has(noty.senderUserId);
        var notyFilter = this.sharedFeedFilters.noty;
        if (
            notyFilter[noty.type] &&
            (notyFilter[noty.type] === 'On' ||
                notyFilter[noty.type] === 'Friends' ||
                (notyFilter[noty.type] === 'VIP' && noty.isFavorite))
        ) {
            this.playNoty(noty);
        }
    };

    $app.methods.updateSharedFeedFriendLogTable = function (forceUpdate) {
        // TrustLevel, Friend, FriendRequest, Unfriend, DisplayName
        var { data } = this.friendLogTable;
        var i = data.length;
        if (i > 0) {
            if (
                data[i - 1].created_at ===
                    this.sharedFeed.friendLogTable.lastEntryDate &&
                forceUpdate === false
            ) {
                return;
            }
            this.sharedFeed.friendLogTable.lastEntryDate =
                data[i - 1].created_at;
        } else {
            return;
        }
        var bias = new Date(Date.now() - 86400000).toJSON(); // 24 hours
        var wristArr = [];
        var w = 0;
        var wristFilter = this.sharedFeedFilters.wrist;
        for (var i = data.length - 1; i > -1; i--) {
            var ctx = data[i];
            if (ctx.created_at < bias) {
                break;
            }
            if (ctx.type === 'FriendRequest') {
                continue;
            }
            var isFriend = this.friends.has(ctx.userId);
            var isFavorite = API.cachedFavoritesByObjectId.has(ctx.userId);
            if (
                w < 20 &&
                wristFilter[ctx.type] &&
                (wristFilter[ctx.type] === 'On' ||
                    wristFilter[ctx.type] === 'Friends' ||
                    (wristFilter[ctx.type] === 'VIP' && isFavorite))
            ) {
                wristArr.push({
                    ...ctx,
                    isFriend,
                    isFavorite
                });
                ++w;
            }
        }
        this.sharedFeed.friendLogTable.wrist = wristArr;
        this.sharedFeed.pendingUpdate = true;
    };

    $app.methods.queueFriendLogNoty = function (noty) {
        if (noty.type === 'FriendRequest') {
            return;
        }
        noty.isFriend = this.friends.has(noty.userId);
        noty.isFavorite = API.cachedFavoritesByObjectId.has(noty.userId);
        var notyFilter = this.sharedFeedFilters.noty;
        if (
            notyFilter[noty.type] &&
            (notyFilter[noty.type] === 'On' ||
                notyFilter[noty.type] === 'Friends' ||
                (notyFilter[noty.type] === 'VIP' && noty.isFavorite))
        ) {
            this.playNoty(noty);
        }
    };

    $app.methods.updateSharedFeedModerationAgainstTable = function (
        forceUpdate
    ) {
        // Unblocked, Blocked, Muted, Unmuted
        var data = this.moderationAgainstTable;
        var i = data.length;
        if (i > 0) {
            if (
                data[i - 1].created_at ===
                    this.sharedFeed.moderationAgainstTable.lastEntryDate &&
                forceUpdate === false
            ) {
                return;
            }
            this.sharedFeed.moderationAgainstTable.lastEntryDate =
                data[i - 1].created_at;
        } else {
            return;
        }
        var bias = new Date(Date.now() - 86400000).toJSON(); // 24 hours
        var wristArr = [];
        var w = 0;
        var wristFilter = this.sharedFeedFilters.wrist;
        for (var i = data.length - 1; i > -1; i--) {
            var ctx = data[i];
            if (ctx.created_at < bias) {
                break;
            }
            var isFriend = this.friends.has(ctx.userId);
            var isFavorite = API.cachedFavoritesByObjectId.has(ctx.userId);
            // add tag colour
            var tagColour = '';
            var tagRef = this.customUserTags.get(ctx.userId);
            if (typeof tagRef !== 'undefined') {
                tagColour = tagRef.colour;
            }
            if (
                w < 20 &&
                wristFilter[ctx.type] &&
                wristFilter[ctx.type] === 'On'
            ) {
                wristArr.push({
                    ...ctx,
                    isFriend,
                    isFavorite,
                    tagColour
                });
                ++w;
            }
        }
        this.sharedFeed.moderationAgainstTable.wrist = wristArr;
        this.sharedFeed.pendingUpdate = true;
    };

    $app.methods.queueModerationNoty = function (noty) {
        noty.isFriend = false;
        noty.isFavorite = false;
        if (noty.userId) {
            noty.isFriend = this.friends.has(noty.userId);
            noty.isFavorite = API.cachedFavoritesByObjectId.has(noty.userId);
        }
        var notyFilter = this.sharedFeedFilters.noty;
        if (notyFilter[noty.type] && notyFilter[noty.type] === 'On') {
            this.playNoty(noty);
        }
    };

    $app.data.notyMap = [];

    $app.methods.playNoty = function (noty) {
        if (API.currentUser.status === 'busy' || !this.friendLogInitStatus) {
            return;
        }
        var displayName = '';
        if (noty.displayName) {
            displayName = noty.displayName;
        } else if (noty.senderUsername) {
            displayName = noty.senderUsername;
        } else if (noty.sourceDisplayName) {
            displayName = noty.sourceDisplayName;
        }
        if (displayName) {
            // don't play noty twice
            if (
                this.notyMap[displayName] &&
                this.notyMap[displayName] >= noty.created_at
            ) {
                return;
            }
            this.notyMap[displayName] = noty.created_at;
        }
        var bias = new Date(Date.now() - 60000).toJSON();
        if (noty.created_at < bias) {
            // don't play noty if it's over 1min old
            return;
        }

        var playNotificationTTS = false;
        if (
            this.notificationTTS === 'Always' ||
            (this.notificationTTS === 'Inside VR' &&
                !this.isGameNoVR &&
                this.isGameRunning) ||
            (this.notificationTTS === 'Game Closed' && !this.isGameRunning) ||
            (this.notificationTTS === 'Game Running' && this.isGameRunning)
        ) {
            playNotificationTTS = true;
        }
        var playDesktopToast = false;
        if (
            this.desktopToast === 'Always' ||
            (this.desktopToast === 'Outside VR' &&
                (this.isGameNoVR || !this.isGameRunning)) ||
            (this.desktopToast === 'Inside VR' &&
                !this.isGameNoVR &&
                this.isGameRunning) ||
            (this.desktopToast === 'Game Closed' && !this.isGameRunning) ||
            (this.desktopToast === 'Game Running' && this.isGameRunning) ||
            (this.desktopToast === 'Desktop Mode' &&
                this.isGameNoVR &&
                this.isGameRunning) ||
            (this.afkDesktopToast &&
                this.isHmdAfk &&
                this.isGameRunning &&
                !this.isGameNoVR)
        ) {
            // this if statement looks like it has seen better days
            playDesktopToast = true;
        }
        var playXSNotification = this.xsNotifications;
        var playOverlayNotification = false;
        if (
            this.overlayNotifications &&
            !this.isGameNoVR &&
            this.isGameRunning
        ) {
            playOverlayNotification = true;
        }
        var message = '';
        if (noty.title) {
            message = `${noty.title}, ${noty.message}`;
        } else if (noty.message) {
            message = noty.message;
        }
        var messageList = [
            'inviteMessage',
            'requestMessage',
            'responseMessage'
        ];
        for (var k = 0; k < messageList.length; k++) {
            if (
                typeof noty.details !== 'undefined' &&
                typeof noty.details[messageList[k]] !== 'undefined'
            ) {
                message = `, ${noty.details[messageList[k]]}`;
            }
        }
        if (playNotificationTTS) {
            this.playNotyTTS(noty, message);
        }
        if (playDesktopToast || playXSNotification || playOverlayNotification) {
            if (this.imageNotifications) {
                this.notySaveImage(noty).then((image) => {
                    if (playXSNotification) {
                        this.displayXSNotification(noty, message, image);
                    }
                    if (playDesktopToast) {
                        this.displayDesktopToast(noty, message, image);
                    }
                    if (playOverlayNotification) {
                        this.displayOverlayNotification(noty, message, image);
                    }
                });
            } else {
                if (playXSNotification) {
                    this.displayXSNotification(noty, message, '');
                }
                if (playDesktopToast) {
                    this.displayDesktopToast(noty, message, '');
                }
                if (playOverlayNotification) {
                    this.displayOverlayNotification(noty, message, '');
                }
            }
        }
    };

    $app.methods.notyGetImage = async function (noty) {
        var imageUrl = '';
        var userId = '';
        if (noty.userId) {
            userId = noty.userId;
        } else if (noty.senderUserId) {
            userId = noty.senderUserId;
        } else if (noty.sourceUserId) {
            userId = noty.sourceUserId;
        } else if (noty.displayName) {
            for (var ref of API.cachedUsers.values()) {
                if (ref.displayName === noty.displayName) {
                    userId = ref.id;
                    break;
                }
            }
        }
        if (noty.thumbnailImageUrl) {
            imageUrl = noty.thumbnailImageUrl;
        } else if (noty.details && noty.details.imageUrl) {
            imageUrl = noty.details.imageUrl;
        } else if (noty.imageUrl) {
            imageUrl = noty.imageUrl;
        } else if (userId) {
            imageUrl = await API.getCachedUser({
                userId
            })
                .catch((err) => {
                    console.error(err);
                    return '';
                })
                .then((args) => {
                    if (
                        this.displayVRCPlusIconsAsAvatar &&
                        args.json.userIcon
                    ) {
                        return args.json.userIcon;
                    }
                    if (args.json.profilePicOverride) {
                        return args.json.profilePicOverride;
                    }
                    return args.json.currentAvatarThumbnailImageUrl;
                });
        }
        return imageUrl;
    };

    $app.methods.notySaveImage = async function (noty) {
        var imageUrl = await this.notyGetImage(noty);
        var fileId = extractFileId(imageUrl);
        var fileVersion = extractFileVersion(imageUrl);
        var imageLocation = '';
        try {
            if (fileId && fileVersion) {
                imageLocation = await AppApi.GetImage(
                    imageUrl,
                    fileId,
                    fileVersion
                );
            } else if (imageUrl) {
                fileVersion = imageUrl.split('/').pop(); // 1416226261.thumbnail-500.png
                fileId = fileVersion.split('.').shift(); // 1416226261
                imageLocation = await AppApi.GetImage(
                    imageUrl,
                    fileId,
                    fileVersion
                );
            }
        } catch (err) {
            console.error(err);
        }
        return imageLocation;
    };

    $app.methods.displayOverlayNotification = function (
        noty,
        message,
        imageFile
    ) {
        var image = '';
        if (imageFile) {
            image = `file:///${imageFile}`;
        }
        AppApi.ExecuteVrOverlayFunction(
            'playNoty',
            JSON.stringify({ noty, message, image })
        );
    };

    $app.methods.playNotyTTS = function (noty, message) {
        switch (noty.type) {
            case 'OnPlayerJoined':
                this.speak(`${noty.displayName} has joined`);
                break;
            case 'OnPlayerLeft':
                this.speak(`${noty.displayName} has left`);
                break;
            case 'OnPlayerJoining':
                this.speak(`${noty.displayName} is joining`);
                break;
            case 'GPS':
                this.speak(
                    `${noty.displayName} is in ${this.displayLocation(
                        noty.location,
                        noty.worldName,
                        noty.groupName
                    )}`
                );
                break;
            case 'Online':
                var locationName = '';
                if (noty.worldName) {
                    locationName = ` to ${this.displayLocation(
                        noty.location,
                        noty.worldName,
                        noty.groupName
                    )}`;
                }
                this.speak(`${noty.displayName} has logged in${locationName}`);
                break;
            case 'Offline':
                this.speak(`${noty.displayName} has logged out`);
                break;
            case 'Status':
                this.speak(
                    `${noty.displayName} status is now ${noty.status} ${noty.statusDescription}`
                );
                break;
            case 'invite':
                this.speak(
                    `${
                        noty.senderUsername
                    } has invited you to ${this.displayLocation(
                        noty.details.worldId,
                        noty.details.worldName,
                        noty.groupName
                    )}${message}`
                );
                break;
            case 'requestInvite':
                this.speak(
                    `${noty.senderUsername} has requested an invite${message}`
                );
                break;
            case 'inviteResponse':
                this.speak(
                    `${noty.senderUsername} has responded to your invite${message}`
                );
                break;
            case 'requestInviteResponse':
                this.speak(
                    `${noty.senderUsername} has responded to your invite request${message}`
                );
                break;
            case 'friendRequest':
                this.speak(
                    `${noty.senderUsername} has sent you a friend request`
                );
                break;
            case 'Friend':
                this.speak(`${noty.displayName} is now your friend`);
                break;
            case 'Unfriend':
                this.speak(`${noty.displayName} is no longer your friend`);
                break;
            case 'TrustLevel':
                this.speak(
                    `${noty.displayName} trust level is now ${noty.trustLevel}`
                );
                break;
            case 'DisplayName':
                this.speak(
                    `${noty.previousDisplayName} changed their name to ${noty.displayName}`
                );
                break;
            case 'group.announcement':
                this.speak(noty.message);
                break;
            case 'group.informative':
                this.speak(noty.message);
                break;
            case 'group.invite':
                this.speak(noty.message);
                break;
            case 'group.joinRequest':
                this.speak(noty.message);
                break;
            case 'group.queueReady':
                this.speak(noty.message);
                break;
            case 'PortalSpawn':
                if (noty.displayName) {
                    this.speak(
                        `${
                            noty.displayName
                        } has spawned a portal to ${this.displayLocation(
                            noty.instanceId,
                            noty.worldName,
                            noty.groupName
                        )}`
                    );
                } else {
                    this.speak('User has spawned a portal');
                }
                break;
            case 'AvatarChange':
                this.speak(
                    `${noty.displayName} changed into avatar ${noty.name}`
                );
                break;
            case 'ChatBoxMessage':
                this.speak(`${noty.displayName} said ${noty.text}`);
                break;
            case 'Event':
                this.speak(noty.data);
                break;
            case 'External':
                this.speak(noty.message);
                break;
            case 'VideoPlay':
                this.speak(`Now playing: ${noty.notyName}`);
                break;
            case 'BlockedOnPlayerJoined':
                this.speak(`Blocked user ${noty.displayName} has joined`);
                break;
            case 'BlockedOnPlayerLeft':
                this.speak(`Blocked user ${noty.displayName} has left`);
                break;
            case 'MutedOnPlayerJoined':
                this.speak(`Muted user ${noty.displayName} has joined`);
                break;
            case 'MutedOnPlayerLeft':
                this.speak(`Muted user ${noty.displayName} has left`);
                break;
            case 'Blocked':
                this.speak(`${noty.displayName} has blocked you`);
                break;
            case 'Unblocked':
                this.speak(`${noty.displayName} has unblocked you`);
                break;
            case 'Muted':
                this.speak(`${noty.displayName} has muted you`);
                break;
            case 'Unmuted':
                this.speak(`${noty.displayName} has unmuted you`);
                break;
        }
    };

    $app.methods.displayXSNotification = function (noty, message, image) {
        var timeout = Math.floor(parseInt(this.notificationTimeout, 10) / 1000);
        switch (noty.type) {
            case 'OnPlayerJoined':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} has joined`,
                    timeout,
                    image
                );
                break;
            case 'OnPlayerLeft':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} has left`,
                    timeout,
                    image
                );
                break;
            case 'OnPlayerJoining':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} is joining`,
                    timeout,
                    image
                );
                break;
            case 'GPS':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} is in ${this.displayLocation(
                        noty.location,
                        noty.worldName,
                        noty.groupName
                    )}`,
                    timeout,
                    image
                );
                break;
            case 'Online':
                var locationName = '';
                if (noty.worldName) {
                    locationName = ` to ${this.displayLocation(
                        noty.location,
                        noty.worldName,
                        noty.groupName
                    )}`;
                }
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} has logged in${locationName}`,
                    timeout,
                    image
                );
                break;
            case 'Offline':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} has logged out`,
                    timeout,
                    image
                );
                break;
            case 'Status':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} status is now ${noty.status} ${noty.statusDescription}`,
                    timeout,
                    image
                );
                break;
            case 'invite':
                AppApi.XSNotification(
                    'VRCX',
                    `${
                        noty.senderUsername
                    } has invited you to ${this.displayLocation(
                        noty.details.worldId,
                        noty.details.worldName
                    )}${message}`,
                    timeout,
                    image
                );
                break;
            case 'requestInvite':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.senderUsername} has requested an invite${message}`,
                    timeout,
                    image
                );
                break;
            case 'inviteResponse':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.senderUsername} has responded to your invite${message}`,
                    timeout,
                    image
                );
                break;
            case 'requestInviteResponse':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.senderUsername} has responded to your invite request${message}`,
                    timeout,
                    image
                );
                break;
            case 'friendRequest':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.senderUsername} has sent you a friend request`,
                    timeout,
                    image
                );
                break;
            case 'Friend':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} is now your friend`,
                    timeout,
                    image
                );
                break;
            case 'Unfriend':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} is no longer your friend`,
                    timeout,
                    image
                );
                break;
            case 'TrustLevel':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} trust level is now ${noty.trustLevel}`,
                    timeout,
                    image
                );
                break;
            case 'DisplayName':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.previousDisplayName} changed their name to ${noty.displayName}`,
                    timeout,
                    image
                );
                break;
            case 'group.announcement':
                AppApi.XSNotification('VRCX', noty.message, timeout, image);
                break;
            case 'group.informative':
                AppApi.XSNotification('VRCX', noty.message, timeout, image);
                break;
            case 'group.invite':
                AppApi.XSNotification('VRCX', noty.message, timeout, image);
                break;
            case 'group.joinRequest':
                AppApi.XSNotification('VRCX', noty.message, timeout, image);
                break;
            case 'group.queueReady':
                AppApi.XSNotification('VRCX', noty.message, timeout, image);
                break;
            case 'PortalSpawn':
                if (noty.displayName) {
                    AppApi.XSNotification(
                        'VRCX',
                        `${
                            noty.displayName
                        } has spawned a portal to ${this.displayLocation(
                            noty.instanceId,
                            noty.worldName,
                            noty.groupName
                        )}`,
                        timeout,
                        image
                    );
                } else {
                    AppApi.XSNotification(
                        'VRCX',
                        'User has spawned a portal',
                        timeout,
                        image
                    );
                }
                break;
            case 'AvatarChange':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} changed into avatar ${noty.name}`,
                    timeout,
                    image
                );
                break;
            case 'ChatBoxMessage':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} said ${noty.text}`,
                    timeout,
                    image
                );
                break;
            case 'Event':
                AppApi.XSNotification('VRCX', noty.data, timeout, image);
                break;
            case 'External':
                AppApi.XSNotification('VRCX', noty.message, timeout, image);
                break;
            case 'VideoPlay':
                AppApi.XSNotification(
                    'VRCX',
                    `Now playing: ${noty.notyName}`,
                    timeout,
                    image
                );
                break;
            case 'BlockedOnPlayerJoined':
                AppApi.XSNotification(
                    'VRCX',
                    `Blocked user ${noty.displayName} has joined`,
                    timeout,
                    image
                );
                break;
            case 'BlockedOnPlayerLeft':
                AppApi.XSNotification(
                    'VRCX',
                    `Blocked user ${noty.displayName} has left`,
                    timeout,
                    image
                );
                break;
            case 'MutedOnPlayerJoined':
                AppApi.XSNotification(
                    'VRCX',
                    `Muted user ${noty.displayName} has joined`,
                    timeout,
                    image
                );
                break;
            case 'MutedOnPlayerLeft':
                AppApi.XSNotification(
                    'VRCX',
                    `Muted user ${noty.displayName} has left`,
                    timeout,
                    image
                );
                break;
            case 'Blocked':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} has blocked you`,
                    timeout,
                    image
                );
                break;
            case 'Unblocked':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} has unblocked you`,
                    timeout,
                    image
                );
                break;
            case 'Muted':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} has muted you`,
                    timeout,
                    image
                );
                break;
            case 'Unmuted':
                AppApi.XSNotification(
                    'VRCX',
                    `${noty.displayName} has unmuted you`,
                    timeout,
                    image
                );
                break;
        }
    };

    $app.methods.displayDesktopToast = function (noty, message, image) {
        switch (noty.type) {
            case 'OnPlayerJoined':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'has joined',
                    image
                );
                break;
            case 'OnPlayerLeft':
                AppApi.DesktopNotification(noty.displayName, 'has left', image);
                break;
            case 'OnPlayerJoining':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'is joining',
                    image
                );
                break;
            case 'GPS':
                AppApi.DesktopNotification(
                    noty.displayName,
                    `is in ${this.displayLocation(
                        noty.location,
                        noty.worldName,
                        noty.groupName
                    )}`,
                    image
                );
                break;
            case 'Online':
                var locationName = '';
                if (noty.worldName) {
                    locationName = ` to ${this.displayLocation(
                        noty.location,
                        noty.worldName,
                        noty.groupName
                    )}`;
                }
                AppApi.DesktopNotification(
                    noty.displayName,
                    `has logged in${locationName}`,
                    image
                );
                break;
            case 'Offline':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'has logged out',
                    image
                );
                break;
            case 'Status':
                AppApi.DesktopNotification(
                    noty.displayName,
                    `status is now ${noty.status} ${noty.statusDescription}`,
                    image
                );
                break;
            case 'invite':
                AppApi.DesktopNotification(
                    noty.senderUsername,
                    `has invited you to ${this.displayLocation(
                        noty.details.worldId,
                        noty.details.worldName
                    )}${message}`,
                    image
                );
                break;
            case 'requestInvite':
                AppApi.DesktopNotification(
                    noty.senderUsername,
                    `has requested an invite${message}`,
                    image
                );
                break;
            case 'inviteResponse':
                AppApi.DesktopNotification(
                    noty.senderUsername,
                    `has responded to your invite${message}`,
                    image
                );
                break;
            case 'requestInviteResponse':
                AppApi.DesktopNotification(
                    noty.senderUsername,
                    `has responded to your invite request${message}`,
                    image
                );
                break;
            case 'friendRequest':
                AppApi.DesktopNotification(
                    noty.senderUsername,
                    'has sent you a friend request',
                    image
                );
                break;
            case 'Friend':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'is now your friend',
                    image
                );
                break;
            case 'Unfriend':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'is no longer your friend',
                    image
                );
                break;
            case 'TrustLevel':
                AppApi.DesktopNotification(
                    noty.displayName,
                    `trust level is now ${noty.trustLevel}`,
                    image
                );
                break;
            case 'DisplayName':
                AppApi.DesktopNotification(
                    noty.previousDisplayName,
                    `changed their name to ${noty.displayName}`,
                    image
                );
                break;
            case 'group.announcement':
                AppApi.DesktopNotification(
                    'Group Announcement',
                    noty.message,
                    image
                );
                break;
            case 'group.informative':
                AppApi.DesktopNotification(
                    'Group Informative',
                    noty.message,
                    image
                );
                break;
            case 'group.invite':
                AppApi.DesktopNotification('Group Invite', noty.message, image);
                break;
            case 'group.joinRequest':
                AppApi.DesktopNotification(
                    'Group Join Request',
                    noty.message,
                    image
                );
                break;
            case 'group.queueReady':
                AppApi.DesktopNotification(
                    'Instance Queue Ready',
                    noty.message,
                    image
                );
                break;
            case 'PortalSpawn':
                if (noty.displayName) {
                    AppApi.DesktopNotification(
                        noty.displayName,
                        `has spawned a portal to ${this.displayLocation(
                            noty.instanceId,
                            noty.worldName,
                            noty.groupName
                        )}`,
                        image
                    );
                } else {
                    AppApi.DesktopNotification(
                        '',
                        'User has spawned a portal',
                        image
                    );
                }
                break;
            case 'AvatarChange':
                AppApi.DesktopNotification(
                    noty.displayName,
                    `changed into avatar ${noty.name}`,
                    image
                );
                break;
            case 'ChatBoxMessage':
                AppApi.DesktopNotification(
                    noty.displayName,
                    `said ${noty.text}`,
                    image
                );
                break;
            case 'Event':
                AppApi.DesktopNotification('Event', noty.data, image);
                break;
            case 'External':
                AppApi.DesktopNotification('External', noty.message, image);
                break;
            case 'VideoPlay':
                AppApi.DesktopNotification('Now playing', noty.notyName, image);
                break;
            case 'BlockedOnPlayerJoined':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'blocked user has joined',
                    image
                );
                break;
            case 'BlockedOnPlayerLeft':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'blocked user has left',
                    image
                );
                break;
            case 'MutedOnPlayerJoined':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'muted user has joined',
                    image
                );
                break;
            case 'MutedOnPlayerLeft':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'muted user has left',
                    image
                );
                break;
            case 'Blocked':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'has blocked you',
                    image
                );
                break;
            case 'Unblocked':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'has unblocked you',
                    image
                );
                break;
            case 'Muted':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'has muted you',
                    image
                );
                break;
            case 'Unmuted':
                AppApi.DesktopNotification(
                    noty.displayName,
                    'has unmuted you',
                    image
                );
                break;
        }
    };

    $app.methods.displayLocation = function (location, worldName, groupName) {
        var text = worldName;
        var L = API.parseLocation(location);
        if (L.isOffline) {
            text = 'Offline';
        } else if (L.isPrivate) {
            text = 'Private';
        } else if (L.isTraveling) {
            text = 'Traveling';
        } else if (L.worldId) {
            if (groupName) {
                text = `${worldName} ${L.accessTypeName}(${groupName})`;
            } else if (L.instanceId) {
                text = `${worldName} ${L.accessTypeName}`;
            }
        }
        return text;
    };

    $app.methods.notifyMenu = function (index) {
        var { menu } = this.$refs;
        if (menu.activeIndex !== index) {
            var item = menu.items[index];
            if (item) {
                item.$el.classList.add('notify');
            }
        }
    };

    $app.methods.selectMenu = function (index) {
        // NOTE
        // 툴팁이 쌓여서 느려지기 때문에 날려줌.
        // 근데 이 방법이 안전한지는 모르겠음
        document.querySelectorAll('[role="tooltip"]').forEach((node) => {
            node.remove();
        });
        var item = this.$refs.menu.items[index];
        if (item) {
            item.$el.classList.remove('notify');
        }
        if (index === 'notification') {
            this.unseenNotifications = [];
        }
    };

    $app.data.twoFactorAuthDialogVisible = false;

    API.$on('LOGIN', function () {
        $app.twoFactorAuthDialogVisible = false;
    });

    $app.methods.promptTOTP = function () {
        if (this.twoFactorAuthDialogVisible) {
            return;
        }
        AppApi.FlashWindow();
        this.twoFactorAuthDialogVisible = true;
        this.$prompt($t('prompt.totp.description'), $t('prompt.totp.header'), {
            distinguishCancelAndClose: true,
            cancelButtonText: $t('prompt.totp.use_otp'),
            confirmButtonText: $t('prompt.totp.verify'),
            inputPlaceholder: $t('prompt.totp.input_placeholder'),
            inputPattern: /^[0-9]{6}$/,
            inputErrorMessage: $t('prompt.totp.input_error'),
            callback: (action, instance) => {
                if (action === 'confirm') {
                    API.verifyTOTP({
                        code: instance.inputValue.trim()
                    })
                        .catch((err) => {
                            this.promptTOTP();
                            throw err;
                        })
                        .then((args) => {
                            API.getCurrentUser();
                            return args;
                        });
                } else if (action === 'cancel') {
                    this.promptOTP();
                }
            },
            beforeClose: (action, instance, done) => {
                this.twoFactorAuthDialogVisible = false;
                done();
            }
        });
    };

    $app.methods.promptOTP = function () {
        if (this.twoFactorAuthDialogVisible) {
            return;
        }
        this.twoFactorAuthDialogVisible = true;
        this.$prompt($t('prompt.otp.description'), $t('prompt.otp.header'), {
            distinguishCancelAndClose: true,
            cancelButtonText: $t('prompt.otp.use_totp'),
            confirmButtonText: $t('prompt.otp.verify'),
            inputPlaceholder: $t('prompt.otp.input_placeholder'),
            inputPattern: /^[a-z0-9]{4}-[a-z0-9]{4}$/,
            inputErrorMessage: $t('prompt.otp.input_error'),
            callback: (action, instance) => {
                if (action === 'confirm') {
                    API.verifyOTP({
                        code: instance.inputValue.trim()
                    })
                        .catch((err) => {
                            this.promptOTP();
                            throw err;
                        })
                        .then((args) => {
                            API.getCurrentUser();
                            return args;
                        });
                } else if (action === 'cancel') {
                    this.promptTOTP();
                }
            },
            beforeClose: (action, instance, done) => {
                this.twoFactorAuthDialogVisible = false;
                done();
            }
        });
    };

    $app.methods.promptEmailOTP = function () {
        if (this.twoFactorAuthDialogVisible) {
            return;
        }
        AppApi.FlashWindow();
        this.twoFactorAuthDialogVisible = true;
        this.$prompt(
            $t('prompt.email_otp.description'),
            $t('prompt.email_otp.header'),
            {
                distinguishCancelAndClose: true,
                cancelButtonText: $t('prompt.email_otp.resend'),
                confirmButtonText: $t('prompt.email_otp.verify'),
                inputPlaceholder: $t('prompt.email_otp.input_placeholder'),
                inputPattern: /^[0-9]{6}$/,
                inputErrorMessage: $t('prompt.email_otp.input_error'),
                callback: (action, instance) => {
                    if (action === 'confirm') {
                        API.verifyEmailOTP({
                            code: instance.inputValue.trim()
                        })
                            .catch((err) => {
                                this.promptEmailOTP();
                                throw err;
                            })
                            .then((args) => {
                                API.getCurrentUser();
                                return args;
                            });
                    } else if (action === 'cancel') {
                        this.resendEmail2fa();
                    }
                },
                beforeClose: (action, instance, done) => {
                    this.twoFactorAuthDialogVisible = false;
                    done();
                }
            }
        );
    };

    $app.methods.resendEmail2fa = function () {
        if (this.loginForm.lastUserLoggedIn) {
            var user =
                this.loginForm.savedCredentials[
                    this.loginForm.lastUserLoggedIn
                ];
            if (typeof user !== 'undefined') {
                webApiService.clearCookies();
                this.relogin(user).then(() => {
                    new Noty({
                        type: 'success',
                        text: 'Successfully relogged in.'
                    }).show();
                });
                return;
            }
        }
        new Noty({
            type: 'error',
            text: 'Cannot send 2FA email without saved credentials. Please login again.'
        }).show();
        this.promptEmailOTP();
    };

    $app.data.exportFriendsListDialog = false;
    $app.data.exportFriendsListCsv = '';
    $app.data.exportFriendsListJson = '';

    $app.methods.showExportFriendsListDialog = function () {
        var { friends } = API.currentUser;
        if (Array.isArray(friends) === false) {
            return;
        }
        var lines = ['UserID,DisplayName,Memo'];
        var _ = function (str) {
            if (/[\x00-\x1f,"]/.test(str) === true) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        var friendsList = [];
        for (var userId of friends) {
            var ref = this.friends.get(userId);
            var name = (typeof ref !== 'undefined' && ref.name) || '';
            var memo =
                (typeof ref !== 'undefined' && ref.memo.replace(/\n/g, ' ')) ||
                '';
            lines.push(`${_(userId)},${_(name)},${_(memo)}`);
            friendsList.push(userId);
        }
        this.exportFriendsListJson = JSON.stringify(
            { friends: friendsList },
            null,
            4
        );
        this.exportFriendsListCsv = lines.join('\n');
        this.exportFriendsListDialog = true;
    };

    $app.data.exportAvatarsListDialog = false;
    $app.data.exportAvatarsListCsv = '';

    $app.methods.showExportAvatarsListDialog = function () {
        for (var ref of API.cachedAvatars.values()) {
            if (ref.authorId === API.currentUser.id) {
                API.cachedAvatars.delete(ref.id);
            }
        }
        var params = {
            n: 50,
            offset: 0,
            sort: 'updated',
            order: 'descending',
            releaseStatus: 'all',
            user: 'me'
        };
        var map = new Map();
        API.bulk({
            fn: 'getAvatars',
            N: -1,
            params,
            handle: (args) => {
                for (var json of args.json) {
                    var $ref = API.cachedAvatars.get(json.id);
                    if (typeof $ref !== 'undefined') {
                        map.set($ref.id, $ref);
                    }
                }
            },
            done: () => {
                var avatars = Array.from(map.values());
                if (Array.isArray(avatars) === false) {
                    return;
                }
                var lines = ['AvatarID,AvatarName'];
                var _ = function (str) {
                    if (/[\x00-\x1f,"]/.test(str) === true) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                };
                for (var avatar of avatars) {
                    lines.push(`${_(avatar.id)},${_(avatar.name)}`);
                }
                this.exportAvatarsListCsv = lines.join('\n');
                this.exportAvatarsListDialog = true;
            }
        });
    };

    API.$on('USER:2FA', function () {
        $app.promptTOTP();
    });

    API.$on('USER:EMAILOTP', function () {
        $app.promptEmailOTP();
    });

    API.$on('LOGOUT', function () {
        if (this.isLoggedIn) {
            new Noty({
                type: 'success',
                text: `See you again, <strong>${escapeTag(
                    this.currentUser.displayName
                )}</strong>!`
            }).show();
        }
        this.isLoggedIn = false;
    });

    API.$on('LOGIN', function (args) {
        new Noty({
            type: 'success',
            text: `Hello there, <strong>${escapeTag(
                args.ref.displayName
            )}</strong>!`
        }).show();
        $app.$refs.menu.activeIndex = 'feed';
    });

    API.$on('LOGOUT', async function () {
        await $app.updateStoredUser(this.currentUser);
        webApiService.clearCookies();
        // eslint-disable-next-line require-atomic-updates
        $app.loginForm.lastUserLoggedIn = '';
        await configRepository.remove('lastUserLoggedIn');
        // workerTimers.setTimeout(() => location.reload(), 500);
    });

    $app.methods.checkPrimaryPassword = function (args) {
        return new Promise((resolve, reject) => {
            if (!this.enablePrimaryPassword) {
                resolve(args.password);
            }
            $app.$prompt(
                $t('prompt.primary_password.description'),
                $t('prompt.primary_password.header'),
                {
                    inputType: 'password',
                    inputPattern: /[\s\S]{1,32}/
                }
            )
                .then(({ value }) => {
                    security
                        .decrypt(args.password, value)
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    };

    $app.data.enablePrimaryPassword = await configRepository.getBool(
        'enablePrimaryPassword',
        false
    );
    $app.data.enablePrimaryPasswordDialog = {
        visible: false,
        password: '',
        rePassword: '',
        beforeClose(done) {
            $app._data.enablePrimaryPassword = false;
            done();
        }
    };
    $app.methods.enablePrimaryPasswordChange = function () {
        this.enablePrimaryPasswordDialog.password = '';
        this.enablePrimaryPasswordDialog.rePassword = '';
        if (this.enablePrimaryPassword) {
            this.enablePrimaryPasswordDialog.visible = true;
        } else {
            this.$prompt(
                $t('prompt.primary_password.description'),
                $t('prompt.primary_password.header'),
                {
                    inputType: 'password',
                    inputPattern: /[\s\S]{1,32}/
                }
            )
                .then(({ value }) => {
                    for (let userId in this.loginForm.savedCredentials) {
                        security
                            .decrypt(
                                this.loginForm.savedCredentials[userId]
                                    .loginParmas.password,
                                value
                            )
                            .then(async (pt) => {
                                this.saveCredentials = {
                                    username:
                                        this.loginForm.savedCredentials[userId]
                                            .loginParmas.username,
                                    password: pt
                                };
                                this.updateStoredUser(
                                    this.loginForm.savedCredentials[userId].user
                                );
                                await configRepository.setBool(
                                    'enablePrimaryPassword',
                                    false
                                );
                            })
                            .catch(async () => {
                                this.enablePrimaryPassword = true;
                                await configRepository.setBool(
                                    'enablePrimaryPassword',
                                    true
                                );
                            });
                    }
                })
                .catch(async () => {
                    this.enablePrimaryPassword = true;
                    await configRepository.setBool(
                        'enablePrimaryPassword',
                        true
                    );
                });
        }
    };
    $app.methods.setPrimaryPassword = async function () {
        await configRepository.setBool(
            'enablePrimaryPassword',
            this.enablePrimaryPassword
        );
        this.enablePrimaryPasswordDialog.visible = false;
        if (this.enablePrimaryPassword) {
            let key = this.enablePrimaryPasswordDialog.password;
            for (let userId in this.loginForm.savedCredentials) {
                security
                    .encrypt(
                        this.loginForm.savedCredentials[userId].loginParmas
                            .password,
                        key
                    )
                    .then((ct) => {
                        this.saveCredentials = {
                            username:
                                this.loginForm.savedCredentials[userId]
                                    .loginParmas.username,
                            password: ct
                        };
                        this.updateStoredUser(
                            this.loginForm.savedCredentials[userId].user
                        );
                    });
            }
        }
    };

    $app.methods.updateStoredUser = async function (currentUser) {
        var savedCredentials = {};
        if ((await configRepository.getString('savedCredentials')) !== null) {
            savedCredentials = JSON.parse(
                await configRepository.getString('savedCredentials')
            );
        }
        if (this.saveCredentials) {
            var credentialsToSave = {
                user: currentUser,
                loginParmas: this.saveCredentials
            };
            savedCredentials[currentUser.id] = credentialsToSave;
            delete this.saveCredentials;
        } else if (typeof savedCredentials[currentUser.id] !== 'undefined') {
            savedCredentials[currentUser.id].user = currentUser;
            savedCredentials[currentUser.id].cookies =
                await webApiService.getCookies();
        }
        this.loginForm.savedCredentials = savedCredentials;
        var jsonCredentialsArray = JSON.stringify(savedCredentials);
        await configRepository.setString(
            'savedCredentials',
            jsonCredentialsArray
        );
        this.loginForm.lastUserLoggedIn = currentUser.id;
        await configRepository.setString('lastUserLoggedIn', currentUser.id);
    };

    $app.methods.migrateStoredUsers = async function () {
        var savedCredentials = {};
        if ((await configRepository.getString('savedCredentials')) !== null) {
            savedCredentials = JSON.parse(
                await configRepository.getString('savedCredentials')
            );
        }
        for (let name in savedCredentials) {
            var userId = savedCredentials[name]?.user?.id;
            if (userId && userId !== name) {
                savedCredentials[userId] = savedCredentials[name];
                delete savedCredentials[name];
            }
        }
        await configRepository.setString(
            'savedCredentials',
            JSON.stringify(savedCredentials)
        );
    };

    $app.methods.relogin = function (user) {
        var { loginParmas } = user;
        if (user.cookies) {
            webApiService.setCookies(user.cookies);
        }
        if (loginParmas.endpoint) {
            API.endpointDomain = loginParmas.endpoint;
            API.websocketDomain = loginParmas.websocket;
        } else {
            API.endpointDomain = API.endpointDomainVrchat;
            API.websocketDomain = API.websocketDomainVrchat;
        }
        return new Promise((resolve, reject) => {
            if (this.enablePrimaryPassword) {
                this.checkPrimaryPassword(loginParmas)
                    .then((pwd) => {
                        this.loginForm.loading = true;
                        return API.getConfig()
                            .catch((err) => {
                                this.loginForm.loading = false;
                                reject(err);
                            })
                            .then(() => {
                                API.login({
                                    username: loginParmas.username,
                                    password: pwd,
                                    cipher: loginParmas.password,
                                    endpoint: loginParmas.endpoint,
                                    websocket: loginParmas.websocket
                                })
                                    .catch((err2) => {
                                        this.loginForm.loading = false;
                                        API.logout();
                                        reject(err2);
                                    })
                                    .then(() => {
                                        this.loginForm.loading = false;
                                        resolve();
                                    });
                            });
                    })
                    .catch((_) => {
                        this.$message({
                            message: 'Incorrect primary password',
                            type: 'error'
                        });
                        reject(_);
                    });
            } else {
                API.getConfig()
                    .catch((err) => {
                        this.loginForm.loading = false;
                        reject(err);
                    })
                    .then(() => {
                        API.login({
                            username: loginParmas.username,
                            password: loginParmas.password,
                            endpoint: loginParmas.endpoint,
                            websocket: loginParmas.websocket
                        })
                            .catch((err2) => {
                                this.loginForm.loading = false;
                                API.logout();
                                reject(err2);
                            })
                            .then(() => {
                                this.loginForm.loading = false;
                                resolve();
                            });
                    });
            }
        });
    };

    $app.methods.deleteSavedLogin = async function (userId) {
        var savedCredentials = JSON.parse(
            await configRepository.getString('savedCredentials')
        );
        delete savedCredentials[userId];
        // Disable primary password when no account is available.
        if (Object.keys(savedCredentials).length === 0) {
            this.enablePrimaryPassword = false;
            await configRepository.setBool('enablePrimaryPassword', false);
        }
        this.loginForm.savedCredentials = savedCredentials;
        var jsonCredentials = JSON.stringify(savedCredentials);
        await configRepository.setString('savedCredentials', jsonCredentials);
        new Noty({
            type: 'success',
            text: 'Account removed.'
        }).show();
    };

    API.$on('AUTOLOGIN', function () {
        var user =
            $app.loginForm.savedCredentials[$app.loginForm.lastUserLoggedIn];
        if (typeof user !== 'undefined') {
            if ($app.enablePrimaryPassword) {
                this.logout();
            } else {
                $app.relogin(user).then(() => {
                    new Noty({
                        type: 'success',
                        text: 'Automatically logged in.'
                    }).show();
                });
            }
        }
    });

    $app.data.loginForm = {
        loading: true,
        username: '',
        password: '',
        endpoint: '',
        websocket: '',
        saveCredentials: false,
        savedCredentials:
            (await configRepository.getString('savedCredentials')) !== null
                ? JSON.parse(
                      await configRepository.getString('savedCredentials')
                  )
                : {},
        lastUserLoggedIn: await configRepository.getString('lastUserLoggedIn'),
        rules: {
            username: [
                {
                    required: true,
                    trigger: 'blur'
                }
            ],
            password: [
                {
                    required: true,
                    trigger: 'blur'
                }
            ]
        }
    };

    $app.methods.login = async function () {
        await webApiService.clearCookies();
        this.$refs.loginForm.validate((valid) => {
            if (valid && !this.loginForm.loading) {
                this.loginForm.loading = true;
                if (this.loginForm.endpoint) {
                    API.endpointDomain = this.loginForm.endpoint;
                    API.websocketDomain = this.loginForm.websocket;
                } else {
                    API.endpointDomain = API.endpointDomainVrchat;
                    API.websocketDomain = API.websocketDomainVrchat;
                }
                API.getConfig()
                    .catch((err) => {
                        this.loginForm.loading = false;
                        throw err;
                    })
                    .then((args) => {
                        if (
                            this.loginForm.saveCredentials &&
                            this.enablePrimaryPassword
                        ) {
                            $app.$prompt(
                                $t('prompt.primary_password.description'),
                                $t('prompt.primary_password.header'),
                                {
                                    inputType: 'password',
                                    inputPattern: /[\s\S]{1,32}/
                                }
                            )
                                .then(({ value }) => {
                                    let saveCredential =
                                        this.loginForm.savedCredentials[
                                            Object.keys(
                                                this.loginForm.savedCredentials
                                            )[0]
                                        ];
                                    security
                                        .decrypt(
                                            saveCredential.loginParmas.password,
                                            value
                                        )
                                        .then(() => {
                                            security
                                                .encrypt(
                                                    this.loginForm.password,
                                                    value
                                                )
                                                .then((pwd) => {
                                                    API.login({
                                                        username:
                                                            this.loginForm
                                                                .username,
                                                        password:
                                                            this.loginForm
                                                                .password,
                                                        endpoint:
                                                            this.loginForm
                                                                .endpoint,
                                                        websocket:
                                                            this.loginForm
                                                                .websocket,
                                                        saveCredentials:
                                                            this.loginForm
                                                                .saveCredentials,
                                                        cipher: pwd
                                                    }).then(() => {
                                                        this.loginForm.username =
                                                            '';
                                                        this.loginForm.password =
                                                            '';
                                                        this.loginForm.endpoint =
                                                            '';
                                                        this.loginForm.websocket =
                                                            '';
                                                    });
                                                });
                                        });
                                })
                                .finally(() => {
                                    this.loginForm.loading = false;
                                });
                            return args;
                        }
                        API.login({
                            username: this.loginForm.username,
                            password: this.loginForm.password,
                            endpoint: this.loginForm.endpoint,
                            websocket: this.loginForm.websocket,
                            saveCredentials: this.loginForm.saveCredentials
                        })
                            .then(() => {
                                this.loginForm.username = '';
                                this.loginForm.password = '';
                                this.loginForm.endpoint = '';
                                this.loginForm.websocket = '';
                            })
                            .finally(() => {
                                this.loginForm.loading = false;
                            });
                        return args;
                    });
            }
        });
    };

    $app.methods.loginWithSteam = function () {
        if (!this.loginForm.loading) {
            this.loginForm.loading = true;
            AppApi.LoginWithSteam()
                .catch((err) => {
                    this.loginForm.loading = false;
                    throw err;
                })
                .then((steamTicket) => {
                    if (steamTicket) {
                        API.getConfig()
                            .catch((err) => {
                                this.loginForm.loading = false;
                                throw err;
                            })
                            .then((args) => {
                                API.loginWithSteam({
                                    steamTicket
                                }).finally(() => {
                                    this.loginForm.loading = false;
                                });
                                return args;
                            });
                    } else {
                        this.loginForm.loading = false;
                        this.$message({
                            message: 'It only works when VRChat is running.',
                            type: 'error'
                        });
                    }
                });
        }
    };

    // #endregion
    // #region | User Memos

    $app.methods.migrateMemos = async function () {
        var json = JSON.parse(await VRCXStorage.GetAll());
        database.begin();
        for (var line in json) {
            if (line.substring(0, 8) === 'memo_usr') {
                var userId = line.substring(5);
                var memo = json[line];
                if (memo) {
                    await this.saveMemo(userId, memo);
                    VRCXStorage.Remove(`memo_${userId}`);
                }
            }
        }
        database.commit();
    };

    $app.methods.getMemo = async function (userId) {
        try {
            return await database.getMemo(userId);
        } catch (err) {}
        return {
            userId: '',
            editedAt: '',
            memo: ''
        };
    };

    $app.methods.saveMemo = function (id, memo) {
        if (memo) {
            database.setMemo({
                userId: id,
                editedAt: new Date().toJSON(),
                memo
            });
        } else {
            database.deleteMemo(id);
        }
        var ref = this.friends.get(id);
        if (ref) {
            ref.memo = String(memo || '');
            if (memo) {
                var array = memo.split('\n');
                ref.$nickName = array[0];
            } else {
                ref.$nickName = '';
            }
        }
    };

    $app.methods.getAllMemos = async function () {
        var memeos = await database.getAllMemos();
        memeos.forEach((memo) => {
            var ref = $app.friends.get(memo.userId);
            if (typeof ref !== 'undefined') {
                ref.memo = memo.memo;
                ref.$nickName = '';
                if (memo.memo) {
                    var array = memo.memo.split('\n');
                    ref.$nickName = array[0];
                }
            }
        });
    };

    // #endregion
    // #region | World Memos

    $app.methods.getWorldMemo = async function (worldId) {
        try {
            return await database.getWorldMemo(worldId);
        } catch (err) {}
        return {
            worldId: '',
            editedAt: '',
            memo: ''
        };
    };

    $app.methods.saveWorldMemo = function (worldId, memo) {
        if (memo) {
            database.setWorldMemo({
                worldId,
                editedAt: new Date().toJSON(),
                memo
            });
        } else {
            database.deleteWorldMemo(worldId);
        }
    };

    // #endregion
    // #region | App: Avatar Memos

    $app.methods.getAvatarMemo = async function (avatarId) {
        try {
            return await database.getAvatarMemoDB(avatarId);
        } catch (err) {
            console.error(err);
        }
        return {
            avatarId: '',
            editedAt: '',
            memo: ''
        };
    };

    $app.methods.saveAvatarMemo = function (avatarId, memo) {
        if (memo) {
            database.setAvatarMemo({
                avatarId,
                editedAt: new Date().toJSON(),
                memo
            });
        } else {
            database.deleteAvatarMemo(avatarId);
        }
    };

    // #endregion
    // #region | App: Friends

    $app.data.friends = new Map();
    $app.data.pendingActiveFriends = new Set();
    $app.data.friendsNo = 0;
    $app.data.isFriendsGroupMe = true;
    $app.data.isFriendsGroup0 = true;
    $app.data.isFriendsGroup1 = true;
    $app.data.isFriendsGroup2 = true;
    $app.data.isFriendsGroup3 = false;
    $app.data.isGroupInstances = false;
    $app.data.groupInstances = [];
    $app.data.friendsGroup0_ = [];
    $app.data.friendsGroup1_ = [];
    $app.data.friendsGroup2_ = [];
    $app.data.friendsGroup3_ = [];
    $app.data.friendsGroupA_ = [];
    $app.data.friendsGroupB_ = [];
    $app.data.friendsGroupC_ = [];
    $app.data.friendsGroupD_ = [];
    $app.data.sortFriendsGroup0 = false;
    $app.data.sortFriendsGroup1 = false;
    $app.data.sortFriendsGroup2 = false;
    $app.data.sortFriendsGroup3 = false;

    $app.methods.fetchActiveFriend = function (userId) {
        this.pendingActiveFriends.add(userId);
        // FIXME: handle error
        return API.getUser({
            userId
        }).then((args) => {
            this.pendingActiveFriends.delete(userId);
            return args;
        });
    };

    API.$on('USER:CURRENT', function (args) {
        $app.checkActiveFriends(args.json);
    });

    $app.methods.checkActiveFriends = function (ref) {
        if (
            Array.isArray(ref.activeFriends) === false ||
            !this.friendLogInitStatus
        ) {
            return;
        }
        for (var userId of ref.activeFriends) {
            if (this.pendingActiveFriends.has(userId)) {
                continue;
            }
            var user = API.cachedUsers.get(userId);
            if (typeof user !== 'undefined' && user.status !== 'offline') {
                continue;
            }
            if (this.pendingActiveFriends.size >= 5) {
                break;
            }
            this.fetchActiveFriend(userId);
        }
    };

    API.$on('LOGIN', function () {
        $app.friends.clear();
        $app.pendingActiveFriends.clear();
        $app.friendsNo = 0;
        $app.isFriendsGroup0 = true;
        $app.isFriendsGroup1 = true;
        $app.isFriendsGroup2 = true;
        $app.isFriendsGroup3 = false;
        $app.friendsGroup0_ = [];
        $app.friendsGroup1_ = [];
        $app.friendsGroup2_ = [];
        $app.friendsGroup3_ = [];
        $app.friendsGroupA_ = [];
        $app.friendsGroupB_ = [];
        $app.friendsGroupC_ = [];
        $app.friendsGroupD_ = [];
        $app.sortFriendsGroup0 = false;
        $app.sortFriendsGroup1 = false;
        $app.sortFriendsGroup2 = false;
        $app.sortFriendsGroup3 = false;
    });

    API.$on('USER:CURRENT', function (args) {
        // USER:CURRENT에서 처리를 함
        $app.refreshFriends(args.ref, args.origin);
        $app.updateOnlineFriendCoutner();
    });

    API.$on('FRIEND:ADD', function (args) {
        $app.addFriend(args.params.userId);
    });

    API.$on('FRIEND:DELETE', function (args) {
        $app.deleteFriend(args.params.userId);
    });

    API.$on('FRIEND:STATE', function (args) {
        $app.queueUpdateFriend({
            id: args.params.userId,
            state: args.json.state
        });
    });

    API.$on('FAVORITE', function (args) {
        $app.queueUpdateFriend({ id: args.ref.favoriteId });
    });

    API.$on('FAVORITE:@DELETE', function (args) {
        $app.queueUpdateFriend({ id: args.ref.favoriteId });
    });

    API.$on('LOGIN', function () {
        $app.nextFriendsRefresh = 0;
    });

    $app.methods.refreshFriendsList = async function () {
        await API.getCurrentUser();
        this.nextCurrentUserRefresh = 60; // 30secs
        await API.refreshFriends();
        API.closeWebSocket();
        await API.getCurrentUser();
        this.nextCurrentUserRefresh = 60; // 30secs
    };

    $app.methods.refreshFriends = function (ref, origin) {
        var map = new Map();
        for (var id of ref.friends) {
            map.set(id, 'offline');
        }
        for (var id of ref.offlineFriends) {
            map.set(id, 'offline');
        }
        for (var id of ref.activeFriends) {
            map.set(id, 'active');
        }
        for (var id of ref.onlineFriends) {
            map.set(id, 'online');
        }
        for (var [id, state] of map) {
            if (this.friends.has(id)) {
                this.queueUpdateFriend({ id, state, origin });
            } else {
                this.addFriend(id, state);
            }
        }
        for (var id of this.friends.keys()) {
            if (map.has(id) === false) {
                this.deleteFriend(id);
            }
        }
    };

    $app.methods.addFriend = function (id, state) {
        if (this.friends.has(id)) {
            return;
        }
        var ref = API.cachedUsers.get(id);
        var isVIP = API.cachedFavoritesByObjectId.has(id);
        var ctx = {
            id,
            state: state || 'offline',
            isVIP,
            ref,
            name: '',
            no: ++this.friendsNo,
            memo: '',
            pendingOffline: false,
            $nickName: ''
        };
        if (this.friendLogInitStatus) {
            this.getMemo(id).then((memo) => {
                if (memo.userId === id) {
                    ctx.memo = memo.memo;
                    ctx.$nickName = '';
                    if (memo.memo) {
                        var array = memo.memo.split('\n');
                        ctx.$nickName = array[0];
                    }
                }
            });
        }
        if (typeof ref === 'undefined') {
            ref = this.friendLog.get(id);
            if (typeof ref !== 'undefined' && ref.displayName) {
                ctx.name = ref.displayName;
            }
        } else {
            ctx.name = ref.name;
        }
        this.friends.set(id, ctx);
        if (ctx.state === 'online') {
            if (ctx.isVIP) {
                this.sortFriendsGroup0 = true;
                this.friendsGroup0_.push(ctx);
                this.friendsGroupA_.unshift(ctx);
            } else {
                this.sortFriendsGroup1 = true;
                this.friendsGroup1_.push(ctx);
                this.friendsGroupB_.unshift(ctx);
            }
        } else if (ctx.state === 'active') {
            this.sortFriendsGroup2 = true;
            this.friendsGroup2_.push(ctx);
            this.friendsGroupC_.unshift(ctx);
        } else {
            this.sortFriendsGroup3 = true;
            this.friendsGroup3_.push(ctx);
            this.friendsGroupD_.unshift(ctx);
        }
    };

    $app.methods.deleteFriend = function (id) {
        var ctx = this.friends.get(id);
        if (typeof ctx === 'undefined') {
            return;
        }
        this.friends.delete(id);
        if (ctx.state === 'online') {
            if (ctx.isVIP) {
                removeFromArray(this.friendsGroup0_, ctx);
                removeFromArray(this.friendsGroupA_, ctx);
            } else {
                removeFromArray(this.friendsGroup1_, ctx);
                removeFromArray(this.friendsGroupB_, ctx);
            }
        } else if (ctx.state === 'active') {
            removeFromArray(this.friendsGroup2_, ctx);
            removeFromArray(this.friendsGroupC_, ctx);
        } else {
            removeFromArray(this.friendsGroup3_, ctx);
            removeFromArray(this.friendsGroupD_, ctx);
        }
    };

    $app.data.updateFriendQueue = [];
    $app.data.updateFriendTimer = null;

    $app.methods.queueUpdateFriend = function (ctx) {
        this.updateFriendQueue.push(ctx);
        if (this.updateFriendTimer !== null) {
            return;
        }
        this.updateFriendTimer = workerTimers.setTimeout(() => {
            var queue = [...this.updateFriendQueue];
            this.updateFriendQueue = [];
            this.updateFriendTimer = null;
            for (var i = 0; i < queue.length; ++i) {
                try {
                    this.updateFriend(queue[i]);
                } catch (err) {
                    console.error(err);
                }
            }
        }, 5);
    };

    $app.data.updateFriendInProgress = new Map();

    $app.methods.updateFriend = function (ctx) {
        var { id, state, origin } = ctx;
        var stateInput = state;
        var ctx = this.friends.get(id);
        if (typeof ctx === 'undefined') {
            return;
        }
        var lastOnlineDate = this.APILastOnline.get(id);
        if (
            stateInput &&
            ctx.state !== stateInput &&
            lastOnlineDate &&
            lastOnlineDate > Date.now() - 1000
        ) {
            // crappy double online fix
            if (this.debugFriendState) {
                console.log(
                    ctx.name,
                    new Date().toJSON(),
                    'userAlreadyOnline',
                    stateInput
                );
            }
            return;
        }
        if (stateInput === 'online') {
            this.APILastOnline.set(id, Date.now());
            ctx.pendingOffline = false;
        }
        var ref = API.cachedUsers.get(id);
        var isVIP = API.cachedFavoritesByObjectId.has(id);
        var location = '';
        var $location_at = '';
        if (typeof ref !== 'undefined') {
            var { location, $location_at } = ref;
        }
        if (typeof stateInput === 'undefined' || ctx.state === stateInput) {
            // this is should be: undefined -> user
            if (ctx.ref !== ref) {
                ctx.ref = ref;
                // NOTE
                // AddFriend (CurrentUser) 이후,
                // 서버에서 오는 순서라고 보면 될 듯.
                if (ctx.state === 'online') {
                    if (this.friendLogInitStatus) {
                        API.getUser({
                            userId: id
                        });
                    }
                    if (ctx.isVIP) {
                        removeFromArray(this.friendsGroupA_, ctx);
                        this.sortFriendsGroup0 = true;
                        this.friendsGroupA_.unshift(ctx);
                    } else {
                        removeFromArray(this.friendsGroupB_, ctx);
                        this.sortFriendsGroup0 = true;
                        this.friendsGroupB_.unshift(ctx);
                    }
                } else if (ctx.state === 'active') {
                    removeFromArray(this.friendsGroupC_, ctx);
                    this.friendsGroupC_.push(ctx);
                } else {
                    removeFromArray(this.friendsGroupD_, ctx);
                    this.friendsGroupD_.push(ctx);
                }
            }
            if (ctx.isVIP !== isVIP) {
                ctx.isVIP = isVIP;
                if (ctx.state === 'online') {
                    if (ctx.isVIP) {
                        removeFromArray(this.friendsGroup1_, ctx);
                        removeFromArray(this.friendsGroupB_, ctx);
                        this.sortFriendsGroup0 = true;
                        this.friendsGroup0_.push(ctx);
                        this.friendsGroupA_.unshift(ctx);
                    } else {
                        removeFromArray(this.friendsGroup0_, ctx);
                        removeFromArray(this.friendsGroupA_, ctx);
                        this.sortFriendsGroup1 = true;
                        this.friendsGroup1_.push(ctx);
                        this.friendsGroupB_.unshift(ctx);
                    }
                }
            }
            if (typeof ref !== 'undefined' && ctx.name !== ref.displayName) {
                ctx.name = ref.displayName;
                if (ctx.state === 'online') {
                    if (ctx.isVIP) {
                        this.sortFriendsGroup0 = true;
                    } else {
                        this.sortFriendsGroup1 = true;
                    }
                } else if (ctx.state === 'active') {
                    this.sortFriendsGroup2 = true;
                } else {
                    this.sortFriendsGroup3 = true;
                }
            }
            // FIXME: 도배 가능성 있음
            if (
                origin &&
                ctx.state !== 'online' &&
                typeof ref !== 'undefined' &&
                this.isRealInstance(ref.location)
            ) {
                API.getUser({
                    userId: id
                });
            }
        } else if (
            ctx.state === 'online' &&
            (stateInput === 'active' || stateInput === 'offline')
        ) {
            ctx.ref = ref;
            ctx.isVIP = isVIP;
            if (typeof ref !== 'undefined') {
                ctx.name = ref.displayName;
            }
            // delayed second check to prevent status flapping
            var date = this.updateFriendInProgress.get(id);
            if (date && date > Date.now() - this.pendingOfflineDelay + 5000) {
                // check if already waiting
                if (this.debugFriendState) {
                    console.log(
                        ctx.name,
                        new Date().toJSON(),
                        'pendingOfflineCheck',
                        stateInput
                    );
                }
                return;
            }
            ctx.pendingOffline = true;
            this.updateFriendInProgress.set(id, Date.now());
            // wait 2minutes then check if user came back online
            workerTimers.setTimeout(() => {
                ctx.pendingOffline = false;
                this.updateFriendInProgress.delete(id);
                this.updateFriendDelayedCheck(
                    id,
                    ctx,
                    stateInput,
                    isVIP,
                    location,
                    $location_at
                );
            }, this.pendingOfflineDelay);
        } else {
            ctx.ref = ref;
            ctx.isVIP = isVIP;
            if (typeof ref !== 'undefined') {
                ctx.name = ref.displayName;
            }
            this.updateFriendDelayedCheck(
                id,
                ctx,
                stateInput,
                isVIP,
                location,
                $location_at
            );
        }
    };

    $app.methods.updateFriendDelayedCheck = async function (
        id,
        ctx,
        stateInput,
        isVIP,
        location,
        $location_at
    ) {
        var date = this.APILastOnline.get(id);
        if (
            ctx.state === 'online' &&
            (stateInput === 'active' || stateInput === 'offline') &&
            date &&
            date > Date.now() - 120000
        ) {
            if (this.debugFriendState) {
                console.log(
                    ctx.name,
                    new Date().toJSON(),
                    'falsePositiveOffline',
                    stateInput,
                    ctx.ref.state
                );
            }
            return;
        }
        var newState = stateInput;
        var args = await API.getUser({
            userId: id
        });
        newState = args.ref.state;
        if (this.debugFriendState) {
            console.log(
                ctx.name,
                new Date().toJSON(),
                'updateFriendState',
                stateInput,
                ctx.ref.state
            );
        }
        var newRef = args.ref;
        if (ctx.state !== newState && typeof ctx.ref !== 'undefined') {
            if (
                (newState === 'offline' || newState === 'active') &&
                ctx.state === 'online'
            ) {
                ctx.ref.$online_for = '';
                ctx.ref.$offline_for = Date.now();
                var ts = Date.now();
                var time = ts - $location_at;
                var worldName = await this.getWorldName(location);
                var groupName = await this.getGroupName(location);
                var feed = {
                    created_at: new Date().toJSON(),
                    type: 'Offline',
                    userId: newRef.id,
                    displayName: newRef.displayName,
                    location,
                    worldName,
                    groupName,
                    time
                };
                this.addFeed(feed);
                database.addOnlineOfflineToDatabase(feed);
            } else if (
                newState === 'online' &&
                (ctx.state === 'offline' || ctx.state === 'active')
            ) {
                ctx.ref.$previousLocation = '';
                ctx.ref.$travelingToTime = Date.now();
                ctx.ref.$location_at = Date.now();
                ctx.ref.$online_for = Date.now();
                ctx.ref.$offline_for = '';
                var worldName = await this.getWorldName(newRef.location);
                var groupName = await this.getGroupName(location);
                var feed = {
                    created_at: new Date().toJSON(),
                    type: 'Online',
                    userId: id,
                    displayName: ctx.name,
                    location: newRef.location,
                    worldName,
                    groupName,
                    time: ''
                };
                this.addFeed(feed);
                database.addOnlineOfflineToDatabase(feed);
            }
        }
        if (ctx.state === 'online') {
            if (ctx.isVIP) {
                removeFromArray(this.friendsGroup0_, ctx);
                removeFromArray(this.friendsGroupA_, ctx);
            } else {
                removeFromArray(this.friendsGroup1_, ctx);
                removeFromArray(this.friendsGroupB_, ctx);
            }
        } else if (ctx.state === 'active') {
            removeFromArray(this.friendsGroup2_, ctx);
            removeFromArray(this.friendsGroupC_, ctx);
        } else {
            removeFromArray(this.friendsGroup3_, ctx);
            removeFromArray(this.friendsGroupD_, ctx);
        }
        if (newState === 'online') {
            if (isVIP) {
                this.sortFriendsGroup0 = true;
                this.friendsGroup0_.push(ctx);
                this.friendsGroupA_.unshift(ctx);
            } else {
                this.sortFriendsGroup1 = true;
                this.friendsGroup1_.push(ctx);
                this.friendsGroupB_.unshift(ctx);
            }
        } else if (newState === 'active') {
            this.sortFriendsGroup2 = true;
            this.friendsGroup2_.push(ctx);
            this.friendsGroupC_.unshift(ctx);
        } else {
            this.sortFriendsGroup3 = true;
            this.friendsGroup3_.push(ctx);
            this.friendsGroupD_.unshift(ctx);
        }
        if (ctx.state !== newState) {
            this.updateOnlineFriendCoutner();
        }
        ctx.state = newState;
        ctx.name = newRef.displayName;
        ctx.isVIP = isVIP;
    };

    $app.methods.getWorldName = async function (location) {
        var worldName = '';
        if (this.isRealInstance(location)) {
            try {
                var L = API.parseLocation(location);
                if (L.worldId) {
                    var args = await API.getCachedWorld({
                        worldId: L.worldId
                    });
                    worldName = args.ref.name;
                }
            } catch (err) {}
        }
        return worldName;
    };

    $app.methods.getGroupName = async function (data) {
        if (!data) {
            return '';
        }
        var groupName = '';
        var groupId = data;
        if (!data.startsWith('grp_')) {
            var L = API.parseLocation(data);
            groupId = L.groupId;
            if (!L.groupId) {
                return '';
            }
        }
        try {
            var args = await API.getCachedGroup({
                groupId
            });
            groupName = args.ref.name;
        } catch (err) {}
        return groupName;
    };

    $app.methods.updateFriendGPS = function (userId) {
        if (!this.orderFriendsGroupGPS) {
            if (this.orderFriendsGroupPrivate || this.orderFriendsGroupStatus) {
                this.sortFriendsGroup0 = true;
                this.sortFriendsGroup1 = true;
            }
            return;
        }
        var ctx = this.friends.get(userId);
        if (typeof ctx.ref !== 'undefined' && ctx.state === 'online') {
            if (ctx.isVIP) {
                removeFromArray(this.friendsGroupA_, ctx);
                this.sortFriendsGroup1 = true;
                this.friendsGroupA_.unshift(ctx);
            } else {
                removeFromArray(this.friendsGroupB_, ctx);
                this.sortFriendsGroup0 = true;
                this.friendsGroupB_.unshift(ctx);
            }
        }
    };

    $app.data.onlineFriendCount = 0;
    $app.methods.updateOnlineFriendCoutner = function () {
        var onlineFriendCount =
            this.friendsGroup0.length + this.friendsGroup1.length;
        if (onlineFriendCount !== this.onlineFriendCount) {
            AppApi.ExecuteVrFeedFunction(
                'updateOnlineFriendCount',
                `${onlineFriendCount}`
            );
            this.onlineFriendCount = onlineFriendCount;
        }
    };

    // ascending
    var compareByName = function (a, b) {
        var A = String(a.name).toUpperCase();
        var B = String(b.name).toUpperCase();
        if (A < B) {
            return -1;
        }
        if (A > B) {
            return 1;
        }
        return 0;
    };

    // ascending
    var compareByDisplayName = function (a, b) {
        var A = String(a.displayName).toUpperCase();
        var B = String(b.displayName).toUpperCase();
        if (A < B) {
            return -1;
        }
        if (A > B) {
            return 1;
        }
        return 0;
    };

    // descending
    var compareByUpdatedAt = function (a, b) {
        var A = String(a.updated_at).toUpperCase();
        var B = String(b.updated_at).toUpperCase();
        if (A < B) {
            return 1;
        }
        if (A > B) {
            return -1;
        }
        return 0;
    };

    // descending
    var compareByCreatedAt = function (a, b) {
        var A = String(a.created_at).toUpperCase();
        var B = String(b.created_at).toUpperCase();
        if (A < B) {
            return 1;
        }
        if (A > B) {
            return -1;
        }
        return 0;
    };

    // private
    var compareByPrivate = function (a, b) {
        if (typeof a.ref === 'undefined' || typeof b.ref === 'undefined') {
            return 0;
        }
        if (a.ref.location === 'private' && b.ref.location === 'private') {
            return 0;
        } else if (a.ref.location === 'private') {
            return 1;
        } else if (b.ref.location === 'private') {
            return -1;
        }
        return 0;
    };

    // status
    var compareByStatus = function (a, b) {
        if (typeof a.ref === 'undefined' || typeof b.ref === 'undefined') {
            return 0;
        }
        if (
            $app.orderFriendsGroupPrivate &&
            (a.ref.location !== 'private' || b.ref.location !== 'private')
        ) {
            return 0;
        }
        if (a.ref.status === b.ref.status) {
            return 0;
        }
        if (a.ref.state === 'offline') {
            return 1;
        }
        return $app.sortStatus(a.ref.status, b.ref.status);
    };

    $app.methods.sortByStatus = function (a, b, field) {
        return this.sortStatus(a[field], b[field]);
    };

    $app.methods.sortStatus = function (a, b) {
        switch (b) {
            case 'join me':
                switch (a) {
                    case 'active':
                        return 1;
                    case 'ask me':
                        return 1;
                    case 'busy':
                        return 1;
                }
                break;
            case 'active':
                switch (a) {
                    case 'join me':
                        return -1;
                    case 'ask me':
                        return 1;
                    case 'busy':
                        return 1;
                }
                break;
            case 'ask me':
                switch (a) {
                    case 'join me':
                        return -1;
                    case 'active':
                        return -1;
                    case 'busy':
                        return 1;
                }
                break;
            case 'busy':
                switch (a) {
                    case 'join me':
                        return -1;
                    case 'active':
                        return -1;
                    case 'ask me':
                        return -1;
                }
                break;
        }
        return 0;
    };

    // location at
    var compareByLocationAt = function (a, b) {
        if (a.location === 'traveling' && b.location === 'traveling') {
            return 0;
        }
        if (a.location === 'traveling') {
            return 1;
        }
        if (b.location === 'traveling') {
            return -1;
        }
        if (a.$location_at < b.$location_at) {
            return -1;
        }
        if (a.$location_at > b.$location_at) {
            return 1;
        }
        return 0;
    };

    // VIP friends
    $app.computed.friendsGroup0 = function () {
        if (this.orderFriendsGroup0) {
            if (this.orderFriendsGroupPrivate) {
                this.friendsGroupA_.sort(compareByPrivate);
            }
            if (this.orderFriendsGroupStatus) {
                this.friendsGroupA_.sort(compareByStatus);
            }
            return this.friendsGroupA_;
        }
        if (this.sortFriendsGroup0) {
            this.sortFriendsGroup0 = false;
            this.friendsGroup0_.sort(compareByName);
            if (this.orderFriendsGroupPrivate) {
                this.friendsGroup0_.sort(compareByPrivate);
            }
            if (this.orderFriendsGroupStatus) {
                this.friendsGroup0_.sort(compareByStatus);
            }
        }
        return this.friendsGroup0_;
    };

    // Online friends
    $app.computed.friendsGroup1 = function () {
        if (this.orderFriendsGroup1) {
            if (this.orderFriendsGroupPrivate) {
                this.friendsGroupB_.sort(compareByPrivate);
            }
            if (this.orderFriendsGroupStatus) {
                this.friendsGroupB_.sort(compareByStatus);
            }
            return this.friendsGroupB_;
        }
        if (this.sortFriendsGroup1) {
            this.sortFriendsGroup1 = false;
            this.friendsGroup1_.sort(compareByName);
            if (this.orderFriendsGroupPrivate) {
                this.friendsGroup1_.sort(compareByPrivate);
            }
            if (this.orderFriendsGroupStatus) {
                this.friendsGroup1_.sort(compareByStatus);
            }
        }
        return this.friendsGroup1_;
    };

    // Active friends
    $app.computed.friendsGroup2 = function () {
        if (this.orderFriendsGroup2) {
            return this.friendsGroupC_;
        }
        if (this.sortFriendsGroup2) {
            this.sortFriendsGroup2 = false;
            this.friendsGroup2_.sort(compareByName);
        }
        return this.friendsGroup2_;
    };

    // Offline friends
    $app.computed.friendsGroup3 = function () {
        if (this.orderFriendsGroup3) {
            return this.friendsGroupD_;
        }
        if (this.sortFriendsGroup3) {
            this.sortFriendsGroup3 = false;
            this.friendsGroup3_.sort(compareByName);
        }
        return this.friendsGroup3_;
    };

    $app.methods.userStatusClass = function (user, pendingOffline) {
        var style = {};
        if (typeof user !== 'undefined') {
            var id = '';
            if (user.id) {
                id = user.id;
            } else if (user.userId) {
                id = user.userId;
            }
            if (id === API.currentUser.id) {
                return this.statusClass(user.status);
            }
            if (!user.isFriend) {
                return style;
            }
            if (pendingOffline) {
                // Pending offline
                style.offline = true;
            } else if (
                user.status !== 'active' &&
                user.location === 'private' &&
                user.state === '' &&
                id &&
                !API.currentUser.onlineFriends.includes(id)
            ) {
                // temp fix
                if (API.currentUser.activeFriends.includes(id)) {
                    // Active
                    style.active = true;
                } else {
                    // Offline
                    style.offline = true;
                }
            } else if (user.state === 'active') {
                // Active
                style.active = true;
            } else if (user.location === 'offline') {
                // Offline
                style.offline = true;
            } else if (user.status === 'active') {
                // Online
                style.online = true;
            } else if (user.status === 'join me') {
                // Join Me
                style.joinme = true;
            } else if (user.status === 'ask me') {
                // Ask Me
                style.askme = true;
            } else if (user.status === 'busy') {
                // Do Not Disturb
                style.busy = true;
            }
        }
        return style;
    };

    $app.methods.statusClass = function (status) {
        var style = {};
        if (typeof status !== 'undefined') {
            if (status === 'active') {
                // Online
                style.online = true;
            } else if (status === 'join me') {
                // Join Me
                style.joinme = true;
            } else if (status === 'ask me') {
                // Ask Me
                style.askme = true;
            } else if (status === 'busy') {
                // Do Not Disturb
                style.busy = true;
            }
        }
        return style;
    };

    $app.methods.confirmDeleteFriend = function (id) {
        this.$confirm('Continue? Unfriend', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    API.deleteFriend({
                        userId: id
                    });
                }
            }
        });
    };

    // #endregion
    // #region | App: Quick Search

    $app.data.quickSearch = '';
    $app.data.quickSearchItems = [];

    $app.methods.quickSearchRemoteMethod = function (query) {
        var results = [];
        if (query) {
            var QUERY = query.toUpperCase();
            for (var ctx of this.friends.values()) {
                if (typeof ctx.ref === 'undefined') {
                    continue;
                }
                var NAME = ctx.name.toUpperCase();
                var match = NAME.includes(QUERY);
                if (!match && ctx.memo) {
                    match = String(ctx.memo).toUpperCase().includes(QUERY);
                }
                if (!match && ctx.ref.note) {
                    match = String(ctx.ref.note).toUpperCase().includes(QUERY);
                }
                if (match) {
                    results.push({
                        value: ctx.id,
                        label: ctx.name,
                        ref: ctx.ref,
                        NAME
                    });
                }
            }
            results.sort(function (a, b) {
                var A = a.NAME.startsWith(QUERY);
                var B = b.NAME.startsWith(QUERY);
                if (A !== B) {
                    if (A) {
                        return -1;
                    }
                    if (B) {
                        return 1;
                    }
                }
                if (a.NAME < b.NAME) {
                    return -1;
                }
                if (a.NAME > b.NAME) {
                    return 1;
                }
                return 0;
            });
            if (results.length > 4) {
                results.length = 4;
            }
            results.push({
                value: `search:${query}`,
                label: query
            });
        }
        this.quickSearchItems = results;
    };

    $app.methods.quickSearchChange = function (value) {
        if (value) {
            if (value.startsWith('search:')) {
                var searchText = value.substr(7);
                if (this.quickSearchItems.length > 1 && searchText.length) {
                    this.friendsListSearch = searchText;
                    this.$refs.menu.activeIndex = 'friendsList';
                } else {
                    this.$refs.menu.activeIndex = 'search';
                    this.searchText = searchText;
                    this.lookupUser({ displayName: searchText });
                }
            } else {
                this.showUserDialog(value);
            }
            this.quickSearchVisibleChange(value);
        }
    };

    // NOTE: 그냥 열고 닫고 했을때 changed 이벤트 발생이 안되기 때문에 넣음
    $app.methods.quickSearchVisibleChange = function (value) {
        if (value) {
            this.quickSearch = '';
            this.quickSearchItems = [];
            this.quickSearchUserHistory();
        }
    };

    // #endregion
    // #region | App: Quick Search User History

    $app.data.showUserDialogHistory = new Set();

    $app.methods.quickSearchUserHistory = function () {
        var userHistory = Array.from(this.showUserDialogHistory.values())
            .reverse()
            .slice(0, 5);
        var results = [];
        userHistory.forEach((userId) => {
            var ref = API.cachedUsers.get(userId);
            if (typeof ref !== 'undefined') {
                results.push({
                    value: ref.id,
                    label: ref.name,
                    ref
                });
            }
        });
        this.quickSearchItems = results;
    };

    // #endregion
    // #region | App: Feed

    $app.methods.feedSearch = function (row) {
        var value = this.feedTable.search.toUpperCase();
        if (!value) {
            return true;
        }
        if (
            value.startsWith('wrld_') &&
            String(row.location).toUpperCase().includes(value)
        ) {
            return true;
        }
        switch (row.type) {
            case 'GPS':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.worldName).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'Online':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.worldName).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'Offline':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.worldName).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'Status':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.status).toUpperCase().includes(value)) {
                    return true;
                }
                if (
                    String(row.statusDescription).toUpperCase().includes(value)
                ) {
                    return true;
                }
                return false;
            case 'Avatar':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.avatarName).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'Bio':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.bio).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.previousBio).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
        }
        return true;
    };

    $app.data.tablePageSize = await configRepository.getInt(
        'VRCX_tablePageSize',
        15
    );

    $app.data.feedTable = {
        data: [],
        search: '',
        vip: false,
        loading: false,
        filter: [],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'created_at',
                order: 'descending'
            }
        },
        pageSize: $app.data.tablePageSize,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [10, 15, 25, 50, 100]
        }
    };

    $app.data.feedSessionTable = [];

    $app.methods.feedTableLookup = async function () {
        await configRepository.setString(
            'VRCX_feedTableFilters',
            JSON.stringify(this.feedTable.filter)
        );
        await configRepository.setBool(
            'VRCX_feedTableVIPFilter',
            this.feedTable.vip
        );
        this.feedTable.loading = true;
        var vipList = [];
        if (this.feedTable.vip) {
            vipList = this.getUserVipList();
        }
        this.feedTable.data = await database.lookupFeedDatabase(
            this.feedTable.search,
            this.feedTable.filter,
            vipList
        );
        this.feedTable.loading = false;
    };

    $app.methods.getUserVipList = function () {
        var vipList = [];
        API.cachedFavorites.forEach((favorite) => {
            if (favorite.type === 'friend') {
                vipList.push(favorite.favoriteId);
            }
        });
        return vipList;
    };

    API.$on('LOGIN', async function (args) {
        $app.friendLog = new Map();
        $app.feedTable.data = [];
        $app.feedSessionTable = [];
        $app.friendLogInitStatus = false;
        await database.initUserTables(args.json.id);
        $app.$refs.menu.activeIndex = 'feed';
        // eslint-disable-next-line require-atomic-updates
        $app.gameLogTable.data = await database.lookupGameLogDatabase(
            $app.gameLogTable.search,
            $app.gameLogTable.filter
        );
        // eslint-disable-next-line require-atomic-updates
        $app.feedSessionTable = await database.getFeedDatabase();
        $app.feedTableLookup();
        // eslint-disable-next-line require-atomic-updates
        $app.notificationTable.data = await database.getNotifications();
        await this.refreshNotifications();
        await $app.getCurrentUserGroups();
        try {
            if (
                await configRepository.getBool(`friendLogInit_${args.json.id}`)
            ) {
                await $app.getFriendLog();
            } else {
                await $app.initFriendLog(args.json.id);
            }
        } catch (err) {
            $app.$message({
                message: 'Failed to load freinds list, logging out',
                type: 'error'
            });
            this.logout();
            throw err;
        }
        $app.getAvatarHistory();
        $app.getAllMemos();
        if ($app.randomUserColours) {
            $app.getNameColour(this.currentUser.id).then((colour) => {
                this.currentUser.$userColour = colour;
            });
            $app.userColourInit();
        }
        this.getAuth();
        $app.updateSharedFeed(true);
        if ($app.isGameRunning) {
            $app.loadPlayerList();
        }
        $app.vrInit();
        // remove old data from json file and migrate to SQLite
        if (await VRCXStorage.Get(`${args.json.id}_friendLogUpdatedAt`)) {
            VRCXStorage.Remove(`${args.json.id}_feedTable`);
            $app.migrateMemos();
            $app.migrateFriendLog(args.json.id);
        }
        await AppApi.IPCAnnounceStart();
    });

    $app.methods.loadPlayerList = function () {
        var data = this.gameLogSessionTable;
        if (data.length === 0) {
            return;
        }
        var length = 0;
        for (var i = data.length - 1; i > -1; i--) {
            var ctx = data[i];
            if (ctx.type === 'Location') {
                this.lastLocation = {
                    date: Date.parse(ctx.created_at),
                    location: ctx.location,
                    name: ctx.worldName,
                    playerList: new Map(),
                    friendList: new Map()
                };
                length = i;
                break;
            }
        }
        if (length > 0) {
            for (var i = length + 1; i < data.length; i++) {
                var ctx = data[i];
                if (ctx.type === 'OnPlayerJoined') {
                    if (!ctx.userId) {
                        for (var ref of API.cachedUsers.values()) {
                            if (ref.displayName === ctx.displayName) {
                                ctx.userId = ref.id;
                                break;
                            }
                        }
                    }
                    var userMap = {
                        displayName: ctx.displayName,
                        userId: ctx.userId,
                        joinTime: Date.parse(ctx.created_at),
                        lastAvatar: ''
                    };
                    this.lastLocation.playerList.set(ctx.displayName, userMap);
                    if (this.friends.has(ctx.userId)) {
                        this.lastLocation.friendList.set(
                            ctx.displayName,
                            userMap
                        );
                    }
                }
                if (ctx.type === 'OnPlayerLeft') {
                    this.lastLocation.playerList.delete(ctx.displayName);
                    this.lastLocation.friendList.delete(ctx.displayName);
                }
            }
            this.lastLocation.playerList.forEach((ref1) => {
                if (ref1.userId && !API.cachedUsers.has(ref1.userId)) {
                    API.getUser({ userId: ref1.userId });
                }
            });

            this.updateCurrentUserLocation();
            this.updateCurrentInstanceWorld();
            this.updateVRLastLocation();
            this.getCurrentInstanceUserList();
            this.applyUserDialogLocation();
            this.applyWorldDialogInstances();
            this.applyGroupDialogInstances();
        }
    };

    $app.data.robotUrl = `${API.endpointDomain}/file/file_0e8c4e32-7444-44ea-ade4-313c010d4bae/1/file`;

    API.$on('USER:UPDATE', async function (args) {
        var { ref, props } = args;
        var friend = $app.friends.get(ref.id);
        if (typeof friend === 'undefined') {
            return;
        }
        if (props.location && ref.id === $app.userDialog.id) {
            // update user dialog instance occupants
            $app.applyUserDialogLocation(true);
        }
        if (props.location && ref.$location.worldId === $app.worldDialog.id) {
            $app.applyWorldDialogInstances();
        }
        if (props.location && ref.$location.groupId === $app.groupDialog.id) {
            $app.applyGroupDialogInstances();
        }
        if (
            props.location &&
            props.location[0] !== 'offline' &&
            props.location[0] !== '' &&
            props.location[1] !== 'offline' &&
            props.location[1] !== '' &&
            props.location[0] !== 'traveling'
        ) {
            // skip GPS if user is offline or traveling
            var previousLocation = props.location[1];
            var time = props.location[2];
            if (previousLocation === 'traveling') {
                previousLocation = ref.$previousLocation;
                var travelTime = Date.now() - ref.$travelingToTime;
                time -= travelTime;
                if (time < 0) {
                    time = 0;
                }
            }
            if (ref.$previousLocation === props.location[0]) {
                // location traveled to is the same
                ref.$location_at = Date.now() - props.location[2];
            } else {
                var worldName = await $app.getWorldName(props.location[0]);
                var groupName = await $app.getGroupName(props.location[0]);
                var feed = {
                    created_at: new Date().toJSON(),
                    type: 'GPS',
                    userId: ref.id,
                    displayName: ref.displayName,
                    location: props.location[0],
                    worldName,
                    groupName,
                    previousLocation,
                    time
                };
                $app.addFeed(feed);
                database.addGPSToDatabase(feed);
                $app.updateFriendGPS(ref.id);
                // clear previousLocation after GPS
                ref.$previousLocation = '';
                ref.$travelingToTime = Date.now();
            }
            if (friend.state !== 'online') {
                API.getUser({ userId: ref.id });
            }
        }
        if (
            props.location &&
            props.location[0] === 'traveling' &&
            props.location[1] !== 'traveling'
        ) {
            // store previous location when user is traveling
            ref.$previousLocation = props.location[1];
            ref.$travelingToTime = Date.now();
            $app.updateFriendGPS(ref.id);
        }
        if (
            (props.currentAvatarImageUrl ||
                props.currentAvatarThumbnailImageUrl) &&
            !ref.profilePicOverride
        ) {
            var currentAvatarImageUrl = '';
            var previousCurrentAvatarImageUrl = '';
            var currentAvatarThumbnailImageUrl = '';
            var previousCurrentAvatarThumbnailImageUrl = '';
            if (props.currentAvatarImageUrl) {
                currentAvatarImageUrl = props.currentAvatarImageUrl[0];
                previousCurrentAvatarImageUrl = props.currentAvatarImageUrl[1];
            } else {
                currentAvatarImageUrl = ref.currentAvatarImageUrl;
                previousCurrentAvatarImageUrl = ref.currentAvatarImageUrl;
            }
            if (props.currentAvatarThumbnailImageUrl) {
                currentAvatarThumbnailImageUrl =
                    props.currentAvatarThumbnailImageUrl[0];
                previousCurrentAvatarThumbnailImageUrl =
                    props.currentAvatarThumbnailImageUrl[1];
            } else {
                currentAvatarThumbnailImageUrl =
                    ref.currentAvatarThumbnailImageUrl;
                previousCurrentAvatarThumbnailImageUrl =
                    ref.currentAvatarThumbnailImageUrl;
            }
            var avatarInfo = {
                ownerId: '',
                avatarName: ''
            };
            try {
                avatarInfo = await $app.getAvatarName(currentAvatarImageUrl);
            } catch (err) {}
            var feed = {
                created_at: new Date().toJSON(),
                type: 'Avatar',
                userId: ref.id,
                displayName: ref.displayName,
                ownerId: avatarInfo.ownerId,
                avatarName: avatarInfo.avatarName,
                currentAvatarImageUrl,
                currentAvatarThumbnailImageUrl,
                previousCurrentAvatarImageUrl,
                previousCurrentAvatarThumbnailImageUrl
            };
            $app.addFeed(feed);
            database.addAvatarToDatabase(feed);
        }
        if (props.status || props.statusDescription) {
            var status = '';
            var previousStatus = '';
            var statusDescription = '';
            var previousStatusDescription = '';
            if (props.status) {
                if (props.status[0]) {
                    status = props.status[0];
                }
                if (props.status[1]) {
                    previousStatus = props.status[1];
                }
            } else if (ref.status) {
                status = ref.status;
                previousStatus = ref.status;
            }
            if (props.statusDescription) {
                if (props.statusDescription[0]) {
                    statusDescription = props.statusDescription[0];
                }
                if (props.statusDescription[1]) {
                    previousStatusDescription = props.statusDescription[1];
                }
            } else if (ref.statusDescription) {
                statusDescription = ref.statusDescription;
                previousStatusDescription = ref.statusDescription;
            }
            var feed = {
                created_at: new Date().toJSON(),
                type: 'Status',
                userId: ref.id,
                displayName: ref.displayName,
                status,
                statusDescription,
                previousStatus,
                previousStatusDescription
            };
            $app.addFeed(feed);
            database.addStatusToDatabase(feed);
        }
        if (props.bio) {
            var bio = '';
            var previousBio = '';
            if (props.bio[0]) {
                bio = props.bio[0];
            }
            if (props.bio[1]) {
                previousBio = props.bio[1];
            }
            var feed = {
                created_at: new Date().toJSON(),
                type: 'Bio',
                userId: ref.id,
                displayName: ref.displayName,
                bio,
                previousBio
            };
            $app.addFeed(feed);
            database.addBioToDatabase(feed);
        }
    });

    $app.methods.addFeed = function (feed) {
        this.queueFeedNoty(feed);
        this.feedSessionTable.push(feed);
        this.updateSharedFeed(false);
        if (
            this.feedTable.filter.length > 0 &&
            !this.feedTable.filter.includes(feed.type)
        ) {
            return;
        }
        if (
            this.feedTable.vip &&
            !API.cachedFavoritesByObjectId.has(feed.userId)
        ) {
            return;
        }
        if (!this.feedSearch(feed)) {
            return;
        }
        this.feedTable.data.push(feed);
        this.sweepFeed();
        this.notifyMenu('feed');
    };

    $app.methods.clearFeed = function () {
        // FIXME: 메시지 수정
        this.$confirm('Continue? Clear Feed', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    // 필터된 데이터만 삭제 하려면.. 허어
                    var T = this.feedTable;
                    T.data = T.data.filter(
                        (row) =>
                            !T.filters.every((filter) => {
                                if (filter.value) {
                                    if (!Array.isArray(filter.value)) {
                                        if (filter.filterFn) {
                                            return filter.filterFn(row, filter);
                                        }
                                        return String(row[filter.prop])
                                            .toUpperCase()
                                            .includes(
                                                String(
                                                    filter.value
                                                ).toUpperCase()
                                            );
                                    }
                                    if (filter.value.length) {
                                        if (filter.filterFn) {
                                            return filter.filterFn(row, filter);
                                        }
                                        var prop = String(
                                            row[filter.prop]
                                        ).toUpperCase();
                                        return filter.value.some((v) =>
                                            prop.includes(
                                                String(v).toUpperCase()
                                            )
                                        );
                                    }
                                }
                                return true;
                            })
                    );
                }
            }
        });
    };

    $app.methods.sweepFeed = function () {
        var { data } = this.feedTable;
        var j = data.length;
        if (j > this.maxTableSize) {
            data.splice(0, j - this.maxTableSize);
        }

        var date = new Date();
        date.setDate(date.getDate() - 1); // 24 hour limit
        var limit = date.toJSON();
        var i = 0;
        var k = this.feedSessionTable.length;
        while (i < k && this.feedSessionTable[i].created_at < limit) {
            ++i;
        }
        if (i === k) {
            this.feedSessionTable = [];
        } else if (i) {
            this.feedSessionTable.splice(0, i);
        }
    };

    // #endregion
    // #region | App: gameLog

    $app.data.lastLocation = {
        date: 0,
        location: '',
        name: '',
        playerList: new Map(),
        friendList: new Map()
    };

    $app.methods.lastLocationReset = function (gameLogDate) {
        var dateTime = gameLogDate;
        if (!gameLogDate) {
            dateTime = new Date().toJSON();
        }
        var dateTimeStamp = Date.parse(dateTime);
        this.photonLobby = new Map();
        this.photonLobbyCurrent = new Map();
        this.photonLobbyMaster = 0;
        this.photonLobbyCurrentUser = 0;
        this.photonLobbyUserData = new Map();
        this.photonLobbyWatcherLoopStop();
        this.photonLobbyAvatars = new Map();
        this.photonLobbyLastModeration = new Map();
        this.photonLobbyJointime = new Map();
        this.photonLobbyActivePortals = new Map();
        this.photonEvent7List = new Map();
        this.photonLastEvent7List = '';
        this.photonLastChatBoxMsg = new Map();
        this.moderationEventQueue = new Map();
        if (this.photonEventTable.data.length > 0) {
            this.photonEventTablePrevious.data = this.photonEventTable.data;
            this.photonEventTable.data = [];
        }
        var playerList = Array.from(this.lastLocation.playerList.values());
        var dataBaseEntries = [];
        for (var ref of playerList) {
            var entry = {
                created_at: dateTime,
                type: 'OnPlayerLeft',
                displayName: ref.displayName,
                location: this.lastLocation.location,
                userId: ref.userId,
                time: dateTimeStamp - ref.joinTime
            };
            dataBaseEntries.unshift(entry);
            this.addGameLog(entry);
        }
        database.addGamelogJoinLeaveBulk(dataBaseEntries);
        if (this.lastLocation.date !== 0) {
            var update = {
                time: dateTimeStamp - this.lastLocation.date,
                created_at: new Date(this.lastLocation.date).toJSON()
            };
            database.updateGamelogLocationTimeToDatabase(update);
        }
        this.gameLogApiLoggingEnabled = false;
        this.lastLocationDestination = '';
        this.lastLocationDestinationTime = 0;
        this.lastLocation = {
            date: 0,
            location: '',
            name: '',
            playerList: new Map(),
            friendList: new Map()
        };
        this.updateCurrentUserLocation();
        this.updateCurrentInstanceWorld();
        this.updateVRLastLocation();
        this.getCurrentInstanceUserList();
        this.lastVideoUrl = '';
        this.lastResourceloadUrl = '';
        this.applyUserDialogLocation();
        this.applyWorldDialogInstances();
        this.applyGroupDialogInstances();
    };

    $app.data.lastLocation$ = {
        tag: '',
        instanceId: '',
        accessType: '',
        worldName: '',
        worldCapacity: 0,
        joinUrl: '',
        statusName: '',
        statusImage: ''
    };

    $app.methods.gameLogSearch = function (row) {
        var value = this.gameLogTable.search.toUpperCase();
        if (!value) {
            return true;
        }
        if (
            value.startsWith('wrld_') &&
            String(row.location).toUpperCase().includes(value)
        ) {
            return true;
        }
        switch (row.type) {
            case 'Location':
                if (String(row.worldName).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'OnPlayerJoined':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'OnPlayerLeft':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'PortalSpawn':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.worldName).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'Event':
                if (String(row.data).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'External':
                if (String(row.message).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'VideoPlay':
                if (String(row.displayName).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.videoName).toUpperCase().includes(value)) {
                    return true;
                }
                if (String(row.videoUrl).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
            case 'StringLoad':
            case 'ImageLoad':
                if (String(row.resourceUrl).toUpperCase().includes(value)) {
                    return true;
                }
                return false;
        }
        return true;
    };

    $app.data.gameLogTable = {
        data: [],
        loading: false,
        search: '',
        filter: [],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'created_at',
                order: 'descending'
            }
        },
        pageSize: $app.data.tablePageSize,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [10, 15, 25, 50, 100]
        }
    };

    $app.data.gameLogSessionTable = [];

    $app.methods.gameLogTableLookup = async function () {
        await configRepository.setString(
            'VRCX_gameLogTableFilters',
            JSON.stringify(this.gameLogTable.filter)
        );
        this.gameLogTable.loading = true;
        this.gameLogTable.data = await database.lookupGameLogDatabase(
            this.gameLogTable.search,
            this.gameLogTable.filter
        );
        this.gameLogTable.loading = false;
    };

    $app.methods.addGameLog = function (entry) {
        this.gameLogSessionTable.push(entry);
        this.updateSharedFeed(false);
        if (entry.type === 'VideoPlay') {
            // event time can be before last gameLog entry
            this.updateSharedFeed(true);
        }
        if (
            entry.type === 'LocationDestination' ||
            entry.type === 'AvatarChange' ||
            entry.type === 'ChatBoxMessage' ||
            (entry.userId === API.currentUser.id &&
                (entry.type === 'OnPlayerJoined' ||
                    entry.type === 'OnPlayerLeft'))
        ) {
            return;
        }
        if (
            this.gameLogTable.filter.length > 0 &&
            !this.gameLogTable.filter.includes(entry.type)
        ) {
            return;
        }
        if (!this.gameLogSearch(entry)) {
            return;
        }
        this.gameLogTable.data.push(entry);
        this.sweepGameLog();
        this.notifyMenu('gameLog');
    };

    $app.methods.resetGameLog = async function () {
        await gameLogService.reset();
        this.gameLogTable.data = [];
        this.lastLocationReset();
    };

    $app.methods.sweepGameLog = function () {
        var { data } = this.gameLogTable;
        var j = data.length;
        if (j > this.maxTableSize) {
            data.splice(0, j - this.maxTableSize);
        }

        var date = new Date();
        date.setDate(date.getDate() - 1); // 24 hour limit
        var limit = date.toJSON();
        var i = 0;
        var k = this.gameLogSessionTable.length;
        while (i < k && this.gameLogSessionTable[i].created_at < limit) {
            ++i;
        }
        if (i === k) {
            this.gameLogSessionTable = [];
        } else if (i) {
            this.gameLogSessionTable.splice(0, i);
        }
    };

    $app.methods.refreshEntireGameLog = async function () {
        await gameLogService.setDateTill('1970-01-01');
        await database.initTables();
        await this.resetGameLog();
        var location = '';
        for (var gameLog of await gameLogService.getAll()) {
            if (gameLog.type === 'location') {
                location = gameLog.location;
            }
            this.addGameLogEntry(gameLog, location);
        }
        this.getGameLogTable();
    };

    $app.methods.getGameLogTable = async function () {
        await database.initTables();
        this.gameLogSessionTable = await database.getGamelogDatabase();
        var dateTill = await database.getLastDateGameLogDatabase();
        this.updateGameLog(dateTill);
    };

    $app.methods.updateGameLog = async function (dateTill) {
        await gameLogService.setDateTill(dateTill);
        await gameLogService.reset();
        await new Promise((resolve) => {
            workerTimers.setTimeout(resolve, 10000);
        });
        var location = '';
        for (var gameLog of await gameLogService.getAll()) {
            if (gameLog.type === 'location') {
                location = gameLog.location;
            }
            this.addGameLogEntry(gameLog, location);
        }
    };

    $app.methods.addGameLogEvent = function (json) {
        var rawLogs = JSON.parse(json);
        var gameLog = gameLogService.parseRawGameLog(
            rawLogs[1],
            rawLogs[2],
            rawLogs.slice(3)
        );
        if (
            this.debugGameLog &&
            gameLog.type !== 'photon-id' &&
            gameLog.type !== 'api-request' &&
            gameLog.type !== 'udon-exception'
        ) {
            console.log('gameLog:', gameLog);
        }
        this.addGameLogEntry(gameLog, this.lastLocation.location);
    };

    $app.methods.deleteGameLogEntry = function (row) {
        this.$confirm('Continue? Delete Log', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    removeFromArray(this.gameLogTable.data, row);
                    database.deleteGameLogEntry(row);
                    console.log(row);
                    database.getGamelogDatabase().then((data) => {
                        this.gameLogSessionTable = data;
                        this.updateSharedFeed(true);
                    });
                }
            }
        });
    };

    $app.data.lastLocationDestination = '';
    $app.data.lastLocationDestinationTime = 0;
    $app.data.lastVideoUrl = '';
    $app.data.lastResourceloadUrl = '';
    $app.data.gameLogApiLoggingEnabled = false;

    $app.methods.addGameLogEntry = function (gameLog, location) {
        if (this.gameLogDisabled) {
            return;
        }
        var userId = '';
        if (gameLog.displayName) {
            for (var ref of API.cachedUsers.values()) {
                if (ref.displayName === gameLog.displayName) {
                    userId = ref.id;
                    break;
                }
            }
        }
        switch (gameLog.type) {
            case 'location-destination':
                if (this.isGameRunning) {
                    // needs to be added before OnPlayerLeft entries from LocationReset
                    this.addGameLog({
                        created_at: gameLog.dt,
                        type: 'LocationDestination',
                        location: gameLog.location
                    });
                    this.lastLocationReset(gameLog.dt);
                    this.lastLocation.location = 'traveling';
                    this.lastLocationDestination = gameLog.location;
                    this.lastLocationDestinationTime = Date.parse(gameLog.dt);
                    this.removeQueuedInstance(gameLog.location);
                    this.updateCurrentUserLocation();
                    this.clearNowPlaying();
                    this.updateCurrentInstanceWorld();
                    this.applyUserDialogLocation();
                    this.applyWorldDialogInstances();
                    this.applyGroupDialogInstances();
                }
                break;
            case 'location':
                var worldName = this.replaceBioSymbols(gameLog.worldName);
                if (this.isGameRunning) {
                    this.lastLocationReset(gameLog.dt);
                    this.clearNowPlaying();
                    this.lastLocation = {
                        date: Date.parse(gameLog.dt),
                        location: gameLog.location,
                        name: worldName,
                        playerList: new Map(),
                        friendList: new Map()
                    };
                    this.removeQueuedInstance(gameLog.location);
                    this.updateCurrentUserLocation();
                    this.updateVRLastLocation();
                    this.updateCurrentInstanceWorld();
                    this.applyUserDialogLocation();
                    this.applyWorldDialogInstances();
                    this.applyGroupDialogInstances();
                }
                var L = API.parseLocation(gameLog.location);
                var entry = {
                    created_at: gameLog.dt,
                    type: 'Location',
                    location: gameLog.location,
                    worldId: L.worldId,
                    worldName,
                    groupName: '',
                    time: 0
                };
                this.getGroupName(gameLog.location).then((groupName) => {
                    entry.groupName = groupName;
                });
                this.addGamelogLocationToDatabase(entry);
                break;
            case 'player-joined':
                var joinTime = Date.parse(gameLog.dt);
                var userMap = {
                    displayName: gameLog.displayName,
                    userId,
                    joinTime,
                    lastAvatar: ''
                };
                this.lastLocation.playerList.set(gameLog.displayName, userMap);
                if (userId) {
                    var ref = API.cachedUsers.get(userId);
                    if (userId === API.currentUser.id) {
                        // skip
                    } else if (this.friends.has(userId)) {
                        this.lastLocation.friendList.set(
                            gameLog.displayName,
                            userMap
                        );
                        if (
                            ref.location !== this.lastLocation.location &&
                            ref.travelingToLocation !==
                                this.lastLocation.location
                        ) {
                            // fix $location_at with private
                            ref.$location_at = joinTime;
                        }
                    } else if (typeof ref !== 'undefined') {
                        // set $location_at to join time if user isn't a friend
                        ref.$location_at = joinTime;
                    }
                } else {
                    // try fetch userId from previous encounter using database
                    database
                        .getUserIdFromDisplayName(gameLog.displayName)
                        .then((oldUserId) => {
                            if (this.isGameRunning) {
                                if (oldUserId) {
                                    API.getUser({ userId: oldUserId });
                                } else if (Date.now() - joinTime < 5 * 1000) {
                                    workerTimers.setTimeout(
                                        () =>
                                            this.silentSeachUser(
                                                gameLog.displayName
                                            ),
                                        10 * 1000
                                    );
                                }
                            }
                        });
                }
                this.updateVRLastLocation();
                this.getCurrentInstanceUserList();
                var entry = {
                    created_at: gameLog.dt,
                    type: 'OnPlayerJoined',
                    displayName: gameLog.displayName,
                    location,
                    userId,
                    time: 0
                };
                database.addGamelogJoinLeaveToDatabase(entry);
                break;
            case 'player-left':
                var ref = this.lastLocation.playerList.get(gameLog.displayName);
                if (typeof ref === 'undefined') {
                    break;
                }
                var time = Date.now() - ref.joinTime;
                this.lastLocation.playerList.delete(gameLog.displayName);
                this.lastLocation.friendList.delete(gameLog.displayName);
                this.photonLobbyAvatars.delete(userId);
                this.updateVRLastLocation();
                this.getCurrentInstanceUserList();
                var entry = {
                    created_at: gameLog.dt,
                    type: 'OnPlayerLeft',
                    displayName: gameLog.displayName,
                    location,
                    userId,
                    time
                };
                database.addGamelogJoinLeaveToDatabase(entry);
                break;
            case 'portal-spawn':
                if (this.ipcEnabled && this.isGameRunning) {
                    break;
                }
                var entry = {
                    created_at: gameLog.dt,
                    type: 'PortalSpawn',
                    location,
                    displayName: '',
                    userId: '',
                    instanceId: '',
                    worldName: ''
                };
                database.addGamelogPortalSpawnToDatabase(entry);
                break;
            case 'video-play':
                gameLog.videoUrl = decodeURI(gameLog.videoUrl);
                if (this.lastVideoUrl === gameLog.videoUrl) {
                    break;
                }
                this.lastVideoUrl = gameLog.videoUrl;
                this.addGameLogVideo(gameLog, location, userId);
                break;
            case 'video-sync':
                var timestamp = gameLog.timestamp.replace(/,/g, '');
                if (this.nowPlaying.playing) {
                    this.nowPlaying.offset = parseInt(timestamp, 10);
                }
                break;
            case 'resource-load-string':
            case 'resource-load-image':
                if (
                    !this.logResourceLoad ||
                    this.lastResourceloadUrl === gameLog.resourceUrl
                ) {
                    break;
                }
                this.lastResourceloadUrl = gameLog.resourceUrl;
                var entry = {
                    created_at: gameLog.dt,
                    type:
                        gameLog.type === 'resource-load-string'
                            ? 'StringLoad'
                            : 'ImageLoad',
                    resourceUrl: gameLog.resourceUrl,
                    location
                };
                database.addGamelogResourceLoadToDatabase(entry);
                break;
            case 'screenshot':
                // var entry = {
                //     created_at: gameLog.dt,
                //     type: 'Event',
                //     data: `Screenshot Processed: ${gameLog.screenshotPath.replace(
                //         /^.*[\\/]/,
                //         ''
                //     )}`
                // };
                // database.addGamelogEventToDatabase(entry);

                this.processScreenshot(gameLog.screenshotPath);
                break;
            case 'api-request':
                var bias = Date.parse(gameLog.dt) + 60 * 1000;
                if (
                    !this.isGameRunning ||
                    this.lastLocation.location === '' ||
                    this.lastLocation.location === 'traveling' ||
                    bias < Date.now()
                ) {
                    break;
                }
                var userId = '';
                try {
                    var url = new URL(gameLog.url);
                    var urlParams = new URLSearchParams(gameLog.url);
                    if (url.pathname.substring(0, 13) === '/api/1/users/') {
                        var pathArray = url.pathname.split('/');
                        userId = pathArray[4];
                    } else if (urlParams.has('userId')) {
                        userId = urlParams.get('userId');
                    }
                } catch (err) {
                    console.error(err);
                }
                if (userId) {
                    this.gameLogApiLoggingEnabled = true;
                    if (!API.cachedUsers.has(userId)) {
                        API.getUser({ userId });
                    }
                }
                break;
            case 'avatar-change':
                var ref = this.lastLocation.playerList.get(gameLog.displayName);
                if (
                    this.photonLoggingEnabled ||
                    typeof ref === 'undefined' ||
                    ref.lastAvatar === gameLog.avatarName
                ) {
                    break;
                }
                if (!ref.lastAvatar) {
                    ref.lastAvatar = gameLog.avatarName;
                    this.lastLocation.playerList.set(gameLog.displayName, ref);
                    break;
                }
                ref.lastAvatar = gameLog.avatarName;
                this.lastLocation.playerList.set(gameLog.displayName, ref);
                var entry = {
                    created_at: gameLog.dt,
                    type: 'AvatarChange',
                    userId,
                    name: gameLog.avatarName,
                    displayName: gameLog.displayName
                };
                break;
            case 'vrcx':
                // VideoPlay(PyPyDance) "https://jd.pypy.moe/api/v1/videos/jr1NX4Jo8GE.mp4",0.1001,239.606,"0905 : [J-POP] 【まなこ】金曜日のおはよう 踊ってみた (vernities)"
                var type = gameLog.data.substr(0, gameLog.data.indexOf(' '));
                if (type === 'VideoPlay(PyPyDance)') {
                    this.addGameLogPyPyDance(gameLog, location);
                } else if (type === 'VideoPlay(VRDancing)') {
                    this.addGameLogVRDancing(gameLog, location);
                } else if (type === 'VideoPlay(ZuwaZuwaDance)') {
                    this.addGameLogZuwaZuwaDance(gameLog, location);
                } else if (type === 'LSMedia') {
                    this.addGameLogLSMedia(gameLog, location);
                } else if (type === 'Movie&Chill') {
                    this.addGameLogMovieAndChill(gameLog, location);
                }
                break;
            case 'photon-id':
                if (!this.isGameRunning || !this.friendLogInitStatus) {
                    break;
                }
                var photonId = parseInt(gameLog.photonId, 10);
                var ref = this.photonLobby.get(photonId);
                if (typeof ref === 'undefined') {
                    for (var ctx of API.cachedUsers.values()) {
                        if (ctx.displayName === gameLog.displayName) {
                            this.photonLobby.set(photonId, ctx);
                            this.photonLobbyCurrent.set(photonId, ctx);
                            break;
                        }
                    }
                    var ctx = {
                        displayName: gameLog.displayName
                    };
                    this.photonLobby.set(photonId, ctx);
                    this.photonLobbyCurrent.set(photonId, ctx);
                    this.getCurrentInstanceUserList();
                }
                break;
            case 'notification':
                // var entry = {
                //     created_at: gameLog.dt,
                //     type: 'Notification',
                //     data: gameLog.json
                // };
                break;
            case 'event':
                var entry = {
                    created_at: gameLog.dt,
                    type: 'Event',
                    data: gameLog.event
                };
                database.addGamelogEventToDatabase(entry);
                break;
            case 'vrc-quit':
                if (!this.vrcQuitFix || !this.isGameRunning) {
                    break;
                }
                var bias = Date.parse(gameLog.dt) + 3000;
                if (bias < Date.now()) {
                    console.log('QuitFix: Bias too low, not killing VRC');
                    break;
                }
                AppApi.QuitGame().then((processCount) => {
                    if (processCount > 1) {
                        console.log(
                            'QuitFix: More than 1 process running, not killing VRC'
                        );
                    } else if (processCount === 1) {
                        console.log('QuitFix: Killed VRC');
                    } else {
                        console.log(
                            'QuitFix: Nothing to kill, no VRC process running'
                        );
                    }
                });
                break;
            case 'openvr-init':
                this.isGameNoVR = false;
                configRepository.setBool('isGameNoVR', this.isGameNoVR);
                this.updateOpenVR();
                break;
            case 'desktop-mode':
                this.isGameNoVR = true;
                configRepository.setBool('isGameNoVR', this.isGameNoVR);
                this.updateOpenVR();
                break;
            case 'udon-exception':
                if (this.udonExceptionLogging) {
                    console.log('UdonException', gameLog.data);
                }
                // var entry = {
                //     created_at: gameLog.dt,
                //     type: 'Event',
                //     data: gameLog.data
                // };
                // database.addGamelogEventToDatabase(entry);
                break;
        }
        if (entry) {
            // add tag colour
            if (entry.userId) {
                var tagRef = this.customUserTags.get(entry.userId);
                if (typeof tagRef !== 'undefined') {
                    entry.tagColour = tagRef.colour;
                }
            }
            this.queueGameLogNoty(entry);
            this.addGameLog(entry);
        }
    };

    $app.methods.silentSeachUser = function (displayName) {
        var playerListRef = this.lastLocation.playerList.get(displayName);
        if (
            !this.gameLogApiLoggingEnabled ||
            !playerListRef ||
            playerListRef.userId
        ) {
            return;
        }
        if (this.debugGameLog) {
            console.log('Fetching userId for', displayName);
        }
        var params = {
            n: 5,
            offset: 0,
            fuzzy: false,
            search: displayName
        };
        API.getUsers(params).then((args) => {
            var map = new Map();
            var nameFound = false;
            for (var json of args.json) {
                var ref = API.cachedUsers.get(json.id);
                if (typeof ref !== 'undefined') {
                    map.set(ref.id, ref);
                }
                if (json.displayName === displayName) {
                    nameFound = true;
                }
            }
            if (!nameFound) {
                console.error('userId not found for', displayName);
            }
            return args;
        });
    };

    $app.methods.addGamelogLocationToDatabase = async function (input) {
        var groupName = await this.getGroupName(input.location);
        var entry = {
            ...input,
            groupName
        };
        database.addGamelogLocationToDatabase(entry);
    };

    $app.data.moderationEventQueue = new Map();
    $app.data.moderationAgainstTable = [];
    $app.data.photonLobby = new Map();
    $app.data.photonLobbyMaster = 0;
    $app.data.photonLobbyCurrentUser = 0;
    $app.data.photonLobbyUserData = new Map();
    $app.data.photonLobbyCurrent = new Map();
    $app.data.photonLobbyAvatars = new Map();
    $app.data.photonLobbyLastModeration = new Map();
    $app.data.photonLobbyWatcherLoop = false;
    $app.data.photonLobbyTimeout = [];
    $app.data.photonLobbyJointime = new Map();
    $app.data.photonLobbyActivePortals = new Map();
    $app.data.photonEvent7List = new Map();
    $app.data.photonLastEvent7List = '';
    $app.data.photonLastChatBoxMsg = new Map();

    $app.data.photonEventType = [
        'MeshVisibility',
        'AnimationFloat',
        'AnimationBool',
        'AnimationTrigger',
        'AudioTrigger',
        'PlayAnimation',
        'SendMessage',
        'SetParticlePlaying',
        'TeleportPlayer',
        'RunConsoleCommand',
        'SetGameObjectActive',
        'SetWebPanelURI',
        'SetWebPanelVolume',
        'SpawnObject',
        'SendRPC',
        'ActivateCustomTrigger',
        'DestroyObject',
        'SetLayer',
        'SetMaterial',
        'AddHealth',
        'AddDamage',
        'SetComponentActive',
        'AnimationInt',
        'AnimationIntAdd',
        'AnimationIntSubtract',
        'AnimationIntMultiply',
        'AnimationIntDivide',
        'AddVelocity',
        'SetVelocity',
        'AddAngularVelocity',
        'SetAngularVelocity',
        'AddForce',
        'SetUIText',
        'CallUdonMethod'
    ];

    $app.data.oldPhotonEmojis = [
        'Angry',
        'Blushing',
        'Crying',
        'Frown',
        'Hand Wave',
        'Hang Ten',
        'In Love',
        'Jack O Lantern',
        'Kiss',
        'Laugh',
        'Skull',
        'Smile',
        'Spooky Ghost',
        'Stoic',
        'Sunglasses',
        'Thinking',
        'Thumbs Down',
        'Thumbs Up',
        'Tongue Out',
        'Wow',
        'Bats',
        'Cloud',
        'Fire',
        'Snow Fall',
        'Snowball',
        'Splash',
        'Web',
        'Beer',
        'Candy',
        'Candy Cane',
        'Candy Corn',
        'Champagne',
        'Drink',
        'Gingerbread',
        'Ice Cream',
        'Pineapple',
        'Pizza',
        'Tomato',
        'Beachball',
        'Coal',
        'Confetti',
        'Gift',
        'Gifts',
        'Life Ring',
        'Mistletoe',
        'Money',
        'Neon Shades',
        'Sun Lotion',
        'Boo',
        'Broken Heart',
        'Exclamation',
        'Go',
        'Heart',
        'Music Note',
        'Question',
        'Stop',
        'Zzz'
    ];

    $app.data.photonEmojis = [
        'Angry',
        'Blushing',
        'Crying',
        'Frown',
        'Hand Wave',
        'Hang Ten',
        'In Love',
        'Jack O Lantern',
        'Kiss',
        'Laugh',
        'Skull',
        'Smile',
        'Spooky Ghost',
        'Stoic',
        'Sunglasses',
        'Thinking',
        'Thumbs Down',
        'Thumbs Up',
        'Tongue Out',
        'Wow',
        'Arrow Point',
        "Can't see",
        'Hourglass',
        'Keyboard',
        'No Headphones',
        'No Mic',
        'Portal',
        'Shush',
        'Bats',
        'Cloud',
        'Fire',
        'Snow Fall',
        'Snowball',
        'Splash',
        'Web',
        'Beer',
        'Candy',
        'Candy Cane',
        'Candy Corn',
        'Champagne',
        'Drink',
        'Gingerbread',
        'Ice Cream',
        'Pineapple',
        'Pizza',
        'Tomato',
        'Beachball',
        'Coal',
        'Confetti',
        'Gift',
        'Gifts',
        'Life Ring',
        'Mistletoe',
        'Money',
        'Neon Shades',
        'Sun Lotion',
        'Boo',
        'Broken Heart',
        'Exclamation',
        'Go',
        'Heart',
        'Music Note',
        'Question',
        'Stop',
        'Zzz'
    ];

    $app.methods.startLobbyWatcherLoop = function () {
        if (!this.photonLobbyWatcherLoop) {
            this.photonLobbyWatcherLoop = true;
            this.photonLobbyWatcher();
        }
    };

    $app.methods.photonLobbyWatcherLoopStop = function () {
        this.photonLobbyWatcherLoop = false;
        this.photonLobbyTimeout = [];
        AppApi.ExecuteVrOverlayFunction('updateHudTimeout', '[]');
    };

    $app.methods.photonLobbyWatcher = function () {
        if (!this.photonLobbyWatcherLoop) {
            return;
        }
        if (this.photonLobbyCurrent.size === 0) {
            this.photonLobbyWatcherLoopStop();
            return;
        }
        var dtNow = Date.now();
        var bias2 = this.photonLastEvent7List + 1.5 * 1000;
        if (dtNow > bias2 || this.lastLocation.playerList.size <= 1) {
            if (this.photonLobbyTimeout.length > 0) {
                AppApi.ExecuteVrOverlayFunction('updateHudTimeout', '[]');
            }
            this.photonLobbyTimeout = [];
            workerTimers.setTimeout(() => this.photonLobbyWatcher(), 500);
            return;
        }
        var hudTimeout = [];
        this.photonEvent7List.forEach((dt, id) => {
            var timeSinceLastEvent = dtNow - Date.parse(dt);
            if (
                timeSinceLastEvent > this.photonLobbyTimeoutThreshold &&
                id !== this.photonLobbyCurrentUser
            ) {
                if (this.photonLobbyJointime.has(id)) {
                    var { joinTime } = this.photonLobbyJointime.get(id);
                }
                if (!joinTime) {
                    console.log(`${id} missing join time`);
                }
                if (joinTime && joinTime + 70000 < dtNow) {
                    // wait 70secs for user to load in
                    hudTimeout.unshift({
                        userId: this.getUserIdFromPhotonId(id),
                        displayName: this.getDisplayNameFromPhotonId(id),
                        time: Math.round(timeSinceLastEvent / 1000),
                        rawTime: timeSinceLastEvent
                    });
                }
            }
        });
        if (this.photonLobbyTimeout.length > 0 || hudTimeout.length > 0) {
            hudTimeout.sort(function (a, b) {
                if (a.rawTime > b.rawTime) {
                    return 1;
                }
                if (a.rawTime < b.rawTime) {
                    return -1;
                }
                return 0;
            });
            if (this.timeoutHudOverlay) {
                if (
                    this.timeoutHudOverlayFilter === 'VIP' ||
                    this.timeoutHudOverlayFilter === 'Friends'
                ) {
                    var filteredHudTimeout = [];
                    hudTimeout.forEach((item) => {
                        if (
                            this.timeoutHudOverlayFilter === 'VIP' &&
                            API.cachedFavoritesByObjectId.has(item.userId)
                        ) {
                            filteredHudTimeout.push(item);
                        } else if (
                            this.timeoutHudOverlayFilter === 'Friends' &&
                            this.friends.has(item.userId)
                        ) {
                            filteredHudTimeout.push(item);
                        }
                    });
                } else {
                    var filteredHudTimeout = hudTimeout;
                }
                AppApi.ExecuteVrOverlayFunction(
                    'updateHudTimeout',
                    JSON.stringify(filteredHudTimeout)
                );
            }
            this.photonLobbyTimeout = hudTimeout;
            this.getCurrentInstanceUserList();
        }
        workerTimers.setTimeout(() => this.photonLobbyWatcher(), 500);
    };

    $app.data.photonEventTableFilter = '';
    $app.data.photonEventTableTypeFilter = [];
    $app.data.photonEventTableTypeOverlayFilter = [];
    $app.data.photonEventTableTypeFilterList = [
        'Event',
        'OnPlayerJoined',
        'OnPlayerLeft',
        'ChangeAvatar',
        'ChangeStatus',
        'ChangeGroup',
        'PortalSpawn',
        'DeletedPortal',
        'ChatBoxMessage',
        'Moderation',
        'Camera',
        'SpawnEmoji',
        'MasterMigrate'
    ];

    $app.methods.photonEventTableFilterChange = async function () {
        this.photonEventTable.filters[0].value = this.photonEventTableFilter;
        this.photonEventTable.filters[1].value =
            this.photonEventTableTypeFilter;

        this.photonEventTablePrevious.filters[0].value =
            this.photonEventTableFilter;
        this.photonEventTablePrevious.filters[1].value =
            this.photonEventTableTypeFilter;

        await configRepository.setString(
            'VRCX_photonEventTypeFilter',
            JSON.stringify(this.photonEventTableTypeFilter)
        );
        await configRepository.setString(
            'VRCX_photonEventTypeOverlayFilter',
            JSON.stringify(this.photonEventTableTypeOverlayFilter)
        );
    };

    $app.data.photonEventTable = {
        data: [],
        filters: [
            {
                prop: ['displayName', 'text'],
                value: ''
            },
            {
                prop: 'type',
                value: [],
                filterFn: (row, filter) =>
                    filter.value.some((v) => v === row.type)
            }
        ],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        pageSize: 10,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [5, 10, 15, 25, 50]
        }
    };

    $app.data.photonEventTablePrevious = {
        data: [],
        filters: [
            {
                prop: ['displayName', 'text'],
                value: ''
            },
            {
                prop: 'type',
                value: [],
                filterFn: (row, filter) =>
                    filter.value.some((v) => v === row.type)
            }
        ],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        pageSize: 10,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [5, 10, 15, 25, 50]
        }
    };

    $app.methods.addEntryPhotonEvent = function (input) {
        var isMaster = false;
        if (input.photonId === this.photonLobbyMaster) {
            isMaster = true;
        }
        var joinTimeRef = this.photonLobbyJointime.get(input.photonId);
        var isModerator = joinTimeRef?.canModerateInstance;
        var photonUserRef = this.photonLobby.get(input.photonId);
        var displayName = '';
        var userId = '';
        var isFriend = false;
        if (typeof photonUserRef !== 'undefined') {
            displayName = photonUserRef.displayName;
            userId = photonUserRef.id;
            isFriend = photonUserRef.isFriend;
        }
        var isFavorite = API.cachedFavoritesByObjectId.has(userId);
        var colour = '';
        var tagRef = this.customUserTags.get(userId);
        if (typeof tagRef !== 'undefined') {
            colour = tagRef.colour;
        }
        var feed = {
            displayName,
            userId,
            isFavorite,
            isFriend,
            isMaster,
            isModerator,
            colour,
            ...input
        };
        this.photonEventTable.data.unshift(feed);
        if (
            this.photonEventTableTypeOverlayFilter.length > 0 &&
            !this.photonEventTableTypeOverlayFilter.includes(feed.type)
        ) {
            return;
        }
        if (this.photonEventOverlay) {
            if (
                this.photonEventOverlayFilter === 'VIP' ||
                this.photonEventOverlayFilter === 'Friends'
            ) {
                if (
                    feed.userId &&
                    ((this.photonEventOverlayFilter === 'VIP' && isFavorite) ||
                        (this.photonEventOverlayFilter === 'Friends' &&
                            isFriend))
                ) {
                    AppApi.ExecuteVrOverlayFunction(
                        'addEntryHudFeed',
                        JSON.stringify(feed)
                    );
                }
            } else {
                AppApi.ExecuteVrOverlayFunction(
                    'addEntryHudFeed',
                    JSON.stringify(feed)
                );
            }
        }
    };

    $app.methods.getDisplayNameFromPhotonId = function (photonId) {
        var displayName = '';
        if (photonId) {
            var ref = this.photonLobby.get(photonId);
            displayName = `ID:${photonId}`;
            if (
                typeof ref !== 'undefined' &&
                typeof ref.displayName !== 'undefined'
            ) {
                displayName = ref.displayName;
            }
        }
        return displayName;
    };

    $app.methods.getUserIdFromPhotonId = function (photonId) {
        var userId = '';
        if (photonId) {
            var ref = this.photonLobby.get(photonId);
            if (typeof ref !== 'undefined' && typeof ref.id !== 'undefined') {
                userId = ref.id;
            }
        }
        return userId;
    };

    $app.methods.showUserFromPhotonId = function (photonId) {
        if (photonId) {
            var ref = this.photonLobby.get(photonId);
            if (typeof ref !== 'undefined') {
                if (typeof ref.id !== 'undefined') {
                    this.showUserDialog(ref.id);
                } else if (typeof ref.displayName !== 'undefined') {
                    this.lookupUser(ref);
                }
            } else {
                this.$message({
                    message: 'No user info available',
                    type: 'error'
                });
            }
        }
    };

    $app.methods.getPhotonIdFromDisplayName = function (displayName) {
        var photonId = '';
        if (displayName) {
            this.photonLobby.forEach((ref, id) => {
                if (
                    typeof ref !== 'undefined' &&
                    ref.displayName === displayName
                ) {
                    photonId = id;
                }
            });
        }
        return photonId;
    };

    $app.methods.getPhotonIdFromUserId = function (userId) {
        var photonId = '';
        if (userId) {
            this.photonLobby.forEach((ref, id) => {
                if (typeof ref !== 'undefined' && ref.id === userId) {
                    photonId = id;
                }
            });
        }
        return photonId;
    };

    $app.methods.sortPhotonId = function (a, b, field) {
        var id1 = this.getPhotonIdFromDisplayName(a[field]);
        var id2 = this.getPhotonIdFromDisplayName(b[field]);
        if (id1 < id2) {
            return 1;
        }
        if (id1 > id2) {
            return -1;
        }
        return 0;
    };

    $app.methods.parsePhotonEvent = function (data, gameLogDate) {
        switch (data.Code) {
            case 253:
                // SetUserProperties
                if (data.Parameters[253] === -1) {
                    for (var i in data.Parameters[251]) {
                        var id = parseInt(i, 10);
                        var user = data.Parameters[251][i];
                        this.parsePhotonUser(id, user.user, gameLogDate);
                        this.parsePhotonAvatarChange(
                            id,
                            user.user,
                            user.avatarDict,
                            gameLogDate
                        );
                        this.parsePhotonGroupChange(
                            id,
                            user.user,
                            user.groupOnNameplate,
                            gameLogDate
                        );
                        this.parsePhotonAvatar(user.avatarDict);
                        this.parsePhotonAvatar(user.favatarDict);
                        var hasInstantiated = false;
                        var lobbyJointime = this.photonLobbyJointime.get(id);
                        if (typeof lobbyJointime !== 'undefined') {
                            hasInstantiated = lobbyJointime.hasInstantiated;
                        }
                        this.photonLobbyJointime.set(id, {
                            joinTime: Date.parse(gameLogDate),
                            hasInstantiated,
                            inVRMode: user.inVRMode,
                            avatarEyeHeight: user.avatarEyeHeight,
                            canModerateInstance: user.canModerateInstance,
                            groupOnNameplate: user.groupOnNameplate,
                            showGroupBadgeToOthers: user.showGroupBadgeToOthers,
                            showSocialRank: user.showSocialRank,
                            useImpostorAsFallback: user.useImpostorAsFallback
                        });
                        this.photonUserJoin(id, user, gameLogDate);
                    }
                } else {
                    console.log('oldSetUserProps', data);
                    var id = parseInt(data.Parameters[253], 10);
                    var user = data.Parameters[251];
                    this.parsePhotonUser(id, user.user, gameLogDate);
                    this.parsePhotonAvatarChange(
                        id,
                        user.user,
                        user.avatarDict,
                        gameLogDate
                    );
                    this.parsePhotonGroupChange(
                        id,
                        user.user,
                        user.groupOnNameplate,
                        gameLogDate
                    );
                    this.parsePhotonAvatar(user.avatarDict);
                    this.parsePhotonAvatar(user.favatarDict);
                    var hasInstantiated = false;
                    var lobbyJointime = this.photonLobbyJointime.get(id);
                    if (typeof lobbyJointime !== 'undefined') {
                        hasInstantiated = lobbyJointime.hasInstantiated;
                    }
                    this.photonLobbyJointime.set(id, {
                        joinTime: Date.parse(gameLogDate),
                        hasInstantiated,
                        inVRMode: user.inVRMode,
                        avatarEyeHeight: user.avatarEyeHeight,
                        canModerateInstance: user.canModerateInstance,
                        groupOnNameplate: user.groupOnNameplate,
                        showGroupBadgeToOthers: user.showGroupBadgeToOthers,
                        showSocialRank: user.showSocialRank,
                        useImpostorAsFallback: user.useImpostorAsFallback
                    });
                    this.photonUserJoin(id, user, gameLogDate);
                }
                break;
            case 42:
                // SetUserProperties
                var id = parseInt(data.Parameters[254], 10);
                var user = data.Parameters[245];
                this.parsePhotonUser(id, user.user, gameLogDate);
                this.parsePhotonAvatarChange(
                    id,
                    user.user,
                    user.avatarDict,
                    gameLogDate
                );
                this.parsePhotonGroupChange(
                    id,
                    user.user,
                    user.groupOnNameplate,
                    gameLogDate
                );
                this.parsePhotonAvatar(user.avatarDict);
                this.parsePhotonAvatar(user.favatarDict);
                var lobbyJointime = this.photonLobbyJointime.get(id);
                this.photonLobbyJointime.set(id, {
                    hasInstantiated: true,
                    ...lobbyJointime,
                    inVRMode: user.inVRMode,
                    avatarEyeHeight: user.avatarEyeHeight,
                    canModerateInstance: user.canModerateInstance,
                    groupOnNameplate: user.groupOnNameplate,
                    showGroupBadgeToOthers: user.showGroupBadgeToOthers,
                    showSocialRank: user.showSocialRank,
                    useImpostorAsFallback: user.useImpostorAsFallback
                });
                break;
            case 255:
                // Join
                if (typeof data.Parameters[249] !== 'undefined') {
                    this.parsePhotonUser(
                        data.Parameters[254],
                        data.Parameters[249].user,
                        gameLogDate
                    );
                    this.parsePhotonAvatarChange(
                        data.Parameters[254],
                        data.Parameters[249].user,
                        data.Parameters[249].avatarDict,
                        gameLogDate
                    );
                    this.parsePhotonGroupChange(
                        data.Parameters[254],
                        data.Parameters[249].user,
                        data.Parameters[249].groupOnNameplate,
                        gameLogDate
                    );
                    this.parsePhotonAvatar(data.Parameters[249].avatarDict);
                    this.parsePhotonAvatar(data.Parameters[249].favatarDict);
                }
                this.parsePhotonLobbyIds(data.Parameters[252]);
                var hasInstantiated = false;
                if (this.photonLobbyCurrentUser === data.Parameters[254]) {
                    // fix current user
                    hasInstantiated = true;
                }
                var ref = this.photonLobbyCurrent.get(data.Parameters[254]);
                if (typeof ref !== 'undefined') {
                    // fix for join event firing twice
                    // fix instantiation happening out of order before join event
                    hasInstantiated = ref.hasInstantiated;
                }
                this.photonLobbyJointime.set(data.Parameters[254], {
                    joinTime: Date.parse(gameLogDate),
                    hasInstantiated,
                    inVRMode: data.Parameters[249].inVRMode,
                    avatarEyeHeight: data.Parameters[249].avatarEyeHeight,
                    canModerateInstance:
                        data.Parameters[249].canModerateInstance,
                    groupOnNameplate: data.Parameters[249].groupOnNameplate,
                    showGroupBadgeToOthers:
                        data.Parameters[249].showGroupBadgeToOthers,
                    showSocialRank: data.Parameters[249].showSocialRank,
                    useImpostorAsFallback:
                        data.Parameters[249].useImpostorAsFallback
                });
                this.photonUserJoin(
                    data.Parameters[254],
                    data.Parameters[249],
                    gameLogDate
                );
                this.startLobbyWatcherLoop();
                break;
            case 254:
                // Leave
                var photonId = data.Parameters[254];
                this.photonUserLeave(photonId, gameLogDate);
                this.photonLobbyCurrent.delete(photonId);
                this.photonLobbyLastModeration.delete(photonId);
                this.photonLobbyJointime.delete(photonId);
                this.photonEvent7List.delete(photonId);
                this.parsePhotonLobbyIds(data.Parameters[252]);
                if (typeof data.Parameters[203] !== 'undefined') {
                    this.setPhotonLobbyMaster(
                        data.Parameters[203],
                        gameLogDate
                    );
                }
                break;
            case 4:
                // Sync
                this.setPhotonLobbyMaster(data.Parameters[254], gameLogDate);
                break;
            case 33:
                // Moderation
                if (data.Parameters[245]['0'] === 21) {
                    if (data.Parameters[245]['1']) {
                        var photonId = data.Parameters[245]['1'];
                        var block = data.Parameters[245]['10'];
                        var mute = data.Parameters[245]['11'];
                        var ref = this.photonLobby.get(photonId);
                        if (
                            typeof ref !== 'undefined' &&
                            typeof ref.id !== 'undefined'
                        ) {
                            this.photonModerationUpdate(
                                ref,
                                photonId,
                                block,
                                mute,
                                gameLogDate
                            );
                        } else {
                            this.moderationEventQueue.set(photonId, {
                                block,
                                mute,
                                gameLogDate
                            });
                        }
                    } else {
                        var blockArray = data.Parameters[245]['10'];
                        var muteArray = data.Parameters[245]['11'];
                        var idList = new Map();
                        blockArray.forEach((photonId1) => {
                            if (muteArray.includes(photonId1)) {
                                idList.set(photonId1, {
                                    isMute: true,
                                    isBlock: true
                                });
                            } else {
                                idList.set(photonId1, {
                                    isMute: false,
                                    isBlock: true
                                });
                            }
                        });
                        muteArray.forEach((photonId2) => {
                            if (!idList.has(photonId2)) {
                                idList.set(photonId2, {
                                    isMute: true,
                                    isBlock: false
                                });
                            }
                        });
                        idList.forEach(({ isMute, isBlock }, photonId3) => {
                            var ref1 = this.photonLobby.get(photonId3);
                            if (
                                typeof ref1 !== 'undefined' &&
                                typeof ref1.id !== 'undefined'
                            ) {
                                this.photonModerationUpdate(
                                    ref1,
                                    photonId3,
                                    isBlock,
                                    isMute,
                                    gameLogDate
                                );
                            } else {
                                this.moderationEventQueue.set(photonId3, {
                                    block: isBlock,
                                    mute: isMute,
                                    gameLogDate
                                });
                            }
                        });
                    }
                } else if (data.Parameters[245]['0'] === 13) {
                    var msg = data.Parameters[245]['2'];
                    this.addEntryPhotonEvent({
                        photonId,
                        text: msg,
                        type: 'Moderation',
                        color: 'yellow',
                        created_at: gameLogDate
                    });
                }
                break;
            case 202:
                // Instantiate
                if (!this.photonLobby.has(data.Parameters[254])) {
                    this.photonLobby.set(data.Parameters[254]);
                }
                if (!this.photonLobbyCurrent.has(data.Parameters[254])) {
                    this.photonLobbyCurrent.set(data.Parameters[254]);
                }
                var lobbyJointime = this.photonLobbyJointime.get(
                    data.Parameters[254]
                );
                if (typeof lobbyJointime !== 'undefined') {
                    this.photonLobbyJointime.set(data.Parameters[254], {
                        ...lobbyJointime,
                        hasInstantiated: true
                    });
                } else {
                    this.photonLobbyJointime.set(data.Parameters[254], {
                        joinTime: Date.parse(gameLogDate),
                        hasInstantiated: true
                    });
                }
                break;
            case 43:
                // Chatbox Message
                var photonId = data.Parameters[254];
                var text = data.Parameters[245];
                if (this.photonLobbyCurrentUser === photonId) {
                    return;
                }
                var lastMsg = this.photonLastChatBoxMsg.get(photonId);
                if (lastMsg === text) {
                    return;
                }
                this.photonLastChatBoxMsg.set(photonId, text);
                var userId = this.getUserIdFromPhotonId(photonId);
                if (
                    this.chatboxUserBlacklist.has(userId) ||
                    this.checkChatboxBlacklist(text)
                ) {
                    return;
                }
                this.addEntryPhotonEvent({
                    photonId,
                    text,
                    type: 'ChatBoxMessage',
                    created_at: gameLogDate
                });
                var entry = {
                    userId,
                    displayName: this.getDisplayNameFromPhotonId(photonId),
                    created_at: gameLogDate,
                    type: 'ChatBoxMessage',
                    text
                };
                this.queueGameLogNoty(entry);
                this.addGameLog(entry);
                break;
            case 70:
                // Portal Spawn
                if (data.Parameters[245][0] === 20) {
                    var portalId = data.Parameters[245][1];
                    var userId = data.Parameters[245][2];
                    var shortName = data.Parameters[245][5];
                    var worldName = data.Parameters[245][8].name;
                    this.addPhotonPortalSpawn(
                        gameLogDate,
                        userId,
                        shortName,
                        worldName
                    );
                    this.photonLobbyActivePortals.set(portalId, {
                        userId,
                        shortName,
                        worldName,
                        created_at: Date.parse(gameLogDate),
                        playerCount: 0,
                        pendingLeave: 0
                    });
                } else if (data.Parameters[245][0] === 21) {
                    var portalId = data.Parameters[245][1];
                    var userId = data.Parameters[245][2];
                    var playerCount = data.Parameters[245][3];
                    var shortName = data.Parameters[245][5];
                    var worldName = '';
                    this.addPhotonPortalSpawn(
                        gameLogDate,
                        userId,
                        shortName,
                        worldName
                    );
                    this.photonLobbyActivePortals.set(portalId, {
                        userId,
                        shortName,
                        worldName,
                        created_at: Date.parse(gameLogDate),
                        playerCount: 0,
                        pendingLeave: 0
                    });
                } else if (data.Parameters[245][0] === 22) {
                    var portalId = data.Parameters[245][1];
                    var text = 'DeletedPortal';
                    var ref = this.photonLobbyActivePortals.get(portalId);
                    if (typeof ref !== 'undefined') {
                        var worldName = ref.worldName;
                        var playerCount = ref.playerCount;
                        var time = timeToText(
                            Date.parse(gameLogDate) - ref.created_at
                        );
                        text = `DeletedPortal after ${time} with ${playerCount} players to "${worldName}"`;
                    }
                    this.addEntryPhotonEvent({
                        text,
                        type: 'DeletedPortal',
                        created_at: gameLogDate
                    });
                    this.photonLobbyActivePortals.delete(portalId);
                } else if (data.Parameters[245][0] === 23) {
                    var portalId = data.Parameters[245][1];
                    var playerCount = data.Parameters[245][3];
                    var ref = this.photonLobbyActivePortals.get(portalId);
                    if (typeof ref !== 'undefined') {
                        ref.pendingLeave++;
                        ref.playerCount = playerCount;
                    }
                } else if (data.Parameters[245][0] === 24) {
                    this.addEntryPhotonEvent({
                        text: 'PortalError failed to create portal',
                        type: 'DeletedPortal',
                        created_at: gameLogDate
                    });
                }
                break;
            case 71:
                // Spawn Emoji
                var photonId = data.Parameters[254];
                if (photonId === this.photonLobbyCurrentUser) {
                    return;
                }
                var type = data.Parameters[245][0];
                var emojiName = '';
                var imageUrl = '';
                if (type === 0) {
                    var emojiId = data.Parameters[245][2];
                    emojiName = this.photonEmojis[emojiId];
                } else if (type === 1) {
                    emojiName = 'Custom';
                    var fileId = data.Parameters[245][1];
                    imageUrl = `https://api.vrchat.cloud/api/1/file/${fileId}/1/`;
                }
                this.addEntryPhotonEvent({
                    photonId,
                    text: emojiName,
                    type: 'SpawnEmoji',
                    created_at: gameLogDate,
                    imageUrl,
                    fileId
                });
                break;
        }
    };

    $app.methods.parseVRCEvent = function (json) {
        // VRC Event
        var datetime = json.dt;
        var eventData = json.VRCEventData;
        var senderId = eventData.Sender;
        if (this.debugPhotonLogging) {
            console.log('VrcEvent:', json);
        }
        if (eventData.EventName === '_SendOnSpawn') {
            return;
        } else if (eventData.EventType > 34) {
            var entry = {
                created_at: datetime,
                type: 'Event',
                data: `${this.getDisplayNameFromPhotonId(
                    senderId
                )} called non existent RPC ${eventData.EventType}`
            };
            this.addPhotonEventToGameLog(entry);
            return;
        }
        if (eventData.EventType === 14) {
            var type = 'Event';
            if (eventData.EventName === 'ChangeVisibility') {
                if (eventData.Data[0] === true) {
                    var text = 'EnableCamera';
                } else if (eventData.Data[0] === false) {
                    var text = 'DisableCamera';
                }
                type = 'Camera';
            } else if (eventData.EventName === 'PhotoCapture') {
                var text = 'PhotoCapture';
                type = 'Camera';
            } else if (eventData.EventName === 'TimerBloop') {
                var text = 'TimerBloop';
                type = 'Camera';
            } else if (eventData.EventName === 'ReloadAvatarNetworkedRPC') {
                var text = 'AvatarReset';
            } else if (eventData.EventName === 'ReleaseBones') {
                var text = 'ResetPhysBones';
            } else if (eventData.EventName === 'SpawnEmojiRPC') {
                var text = this.oldPhotonEmojis[eventData.Data];
                type = 'SpawnEmoji';
            } else {
                var eventVrc = '';
                if (eventData.Data && eventData.Data.length > 0) {
                    eventVrc = ` ${JSON.stringify(eventData.Data).replace(
                        /"([^(")"]+)":/g,
                        '$1:'
                    )}`;
                }
                var text = `${eventData.EventName}${eventVrc}`;
            }
            this.addEntryPhotonEvent({
                photonId: senderId,
                text,
                type,
                created_at: datetime
            });
        } else {
            var eventName = '';
            if (eventData.EventName) {
                eventName = ` ${JSON.stringify(eventData.EventName).replace(
                    /"([^(")"]+)":/g,
                    '$1:'
                )}`;
            }
            if (this.debugPhotonLogging) {
                var displayName = this.getDisplayNameFromPhotonId(senderId);
                var feed = `RPC ${displayName} ${
                    this.photonEventType[eventData.EventType]
                }${eventName}`;
                console.log('VrcRpc:', feed);
            }
        }
    };

    $app.methods.parsePhotonPortalSpawn = async function (
        created_at,
        instanceId,
        ref,
        portalType,
        shortName,
        photonId
    ) {
        var worldName = shortName;
        if (instanceId) {
            worldName = await this.getWorldName(instanceId);
        }
        this.addEntryPhotonEvent({
            photonId,
            text: `${portalType} PortalSpawn to ${worldName}`,
            type: 'PortalSpawn',
            shortName,
            location: instanceId,
            worldName,
            created_at
        });
        this.addPhotonEventToGameLog({
            created_at,
            type: 'PortalSpawn',
            displayName: ref.displayName,
            location: this.lastLocation.location,
            userId: ref.id,
            instanceId,
            worldName
        });
    };

    $app.methods.addPhotonPortalSpawn = async function (
        gameLogDate,
        userId,
        shortName,
        worldName
    ) {
        var instance = await API.getInstanceFromShortName({ shortName });
        var location = instance.json.location;
        var L = API.parseLocation(location);
        var groupName = '';
        if (L.groupId) {
            groupName = await this.getGroupName(L.groupId);
        }
        if (!worldName) {
            // eslint-disable-next-line no-param-reassign
            worldName = await this.getWorldName(location);
        }
        // var newShortName = instance.json.shortName;
        // var portalType = 'Secure';
        // if (shortName === newShortName) {
        //     portalType = 'Unlocked';
        // }
        var displayLocation = this.displayLocation(
            location,
            worldName,
            groupName
        );
        this.addEntryPhotonEvent({
            photonId: this.getPhotonIdFromUserId(userId),
            text: `PortalSpawn to ${displayLocation}`,
            type: 'PortalSpawn',
            shortName,
            location,
            worldName,
            groupName,
            created_at: gameLogDate
        });
        this.addPhotonEventToGameLog({
            created_at: gameLogDate,
            type: 'PortalSpawn',
            displayName: this.getDisplayName(userId),
            location: this.lastLocation.location,
            userId,
            instanceId: location,
            worldName,
            groupName
        });
    };

    $app.methods.addPhotonEventToGameLog = function (entry) {
        this.queueGameLogNoty(entry);
        this.addGameLog(entry);
        if (entry.type === 'PortalSpawn') {
            database.addGamelogPortalSpawnToDatabase(entry);
        } else if (entry.type === 'Event') {
            database.addGamelogEventToDatabase(entry);
        }
    };

    $app.methods.parsePhotonLobbyIds = function (lobbyIds) {
        lobbyIds.forEach((id) => {
            if (!this.photonLobby.has(id)) {
                this.photonLobby.set(id);
            }
            if (!this.photonLobbyCurrent.has(id)) {
                this.photonLobbyCurrent.set(id);
            }
        });
        for (var id of this.photonLobbyCurrent.keys()) {
            if (!lobbyIds.includes(id)) {
                this.photonLobbyCurrent.delete(id);
                this.photonEvent7List.delete(id);
            }
        }
    };

    $app.methods.setPhotonLobbyMaster = function (photonId, gameLogDate) {
        if (this.photonLobbyMaster !== photonId) {
            if (this.photonLobbyMaster !== 0) {
                this.addEntryPhotonEvent({
                    photonId,
                    text: `Photon Master Migrate`,
                    type: 'MasterMigrate',
                    created_at: gameLogDate
                });
            }
            this.photonLobbyMaster = photonId;
        }
    };

    $app.methods.parsePhotonUser = async function (
        photonId,
        user,
        gameLogDate
    ) {
        if (typeof user === 'undefined') {
            console.error('PhotonUser: user is undefined', photonId);
            return;
        }
        var tags = [];
        if (typeof user.tags !== 'undefined') {
            tags = user.tags;
        }
        var ref = API.cachedUsers.get(user.id);
        var photonUser = {
            id: user.id,
            displayName: user.displayName,
            developerType: user.developerType,
            profilePicOverride: user.profilePicOverride,
            currentAvatarImageUrl: user.currentAvatarImageUrl,
            currentAvatarThumbnailImageUrl: user.currentAvatarThumbnailImageUrl,
            userIcon: user.userIcon,
            last_platform: user.last_platform,
            allowAvatarCopying: user.allowAvatarCopying,
            status: user.status,
            statusDescription: user.statusDescription,
            bio: user.bio,
            tags
        };
        this.photonLobby.set(photonId, photonUser);
        this.photonLobbyCurrent.set(photonId, photonUser);
        this.photonLobbyUserDataUpdate(photonId, photonUser, gameLogDate);

        var bias = Date.parse(gameLogDate) + 60 * 1000; // 1min
        if (bias > Date.now()) {
            if (typeof ref === 'undefined' || typeof ref.id === 'undefined') {
                try {
                    var args = await API.getUser({
                        userId: user.id
                    });
                    ref = args.ref;
                } catch (err) {
                    console.error(err);
                    ref = photonUser;
                }
            } else if (
                !ref.isFriend &&
                this.lastLocation.playerList.has(ref.displayName)
            ) {
                var { joinTime } = this.lastLocation.playerList.get(
                    ref.displayName
                );
                if (!joinTime) {
                    joinTime = Date.parse(gameLogDate);
                }
                ref.$location_at = joinTime;
                ref.$online_for = joinTime;
            }
            if (
                typeof ref.id !== 'undefined' &&
                ref.currentAvatarImageUrl !== user.currentAvatarImageUrl
            ) {
                API.applyUser({
                    ...ref,
                    currentAvatarImageUrl: user.currentAvatarImageUrl,
                    currentAvatarThumbnailImageUrl:
                        user.currentAvatarThumbnailImageUrl
                });
            }
        }
        if (typeof ref !== 'undefined' && typeof ref.id !== 'undefined') {
            this.photonLobby.set(photonId, ref);
            this.photonLobbyCurrent.set(photonId, ref);
            // check moderation queue
            if (this.moderationEventQueue.has(photonId)) {
                var { block, mute, gameLogDate } =
                    this.moderationEventQueue.get(photonId);
                this.moderationEventQueue.delete(photonId);
                this.photonModerationUpdate(
                    ref,
                    photonId,
                    block,
                    mute,
                    gameLogDate
                );
            }
        }
    };

    $app.methods.photonLobbyUserDataUpdate = function (
        photonId,
        photonUser,
        gameLogDate
    ) {
        var ref = this.photonLobbyUserData.get(photonId);
        if (
            typeof ref !== 'undefined' &&
            photonId !== this.photonLobbyCurrentUser &&
            (photonUser.status !== ref.status ||
                photonUser.statusDescription !== ref.statusDescription)
        ) {
            this.addEntryPhotonEvent({
                photonId,
                type: 'ChangeStatus',
                status: photonUser.status,
                previousStatus: ref.status,
                statusDescription: this.replaceBioSymbols(
                    photonUser.statusDescription
                ),
                previousStatusDescription: this.replaceBioSymbols(
                    ref.statusDescription
                ),
                created_at: Date.parse(gameLogDate)
            });
        }
        this.photonLobbyUserData.set(photonId, photonUser);
    };

    $app.methods.photonUserJoin = function (photonId, user, gameLogDate) {
        if (photonId === this.photonLobbyCurrentUser) {
            return;
        }
        var avatar = user.avatarDict;
        avatar.name = this.replaceBioSymbols(avatar.name);
        avatar.description = this.replaceBioSymbols(avatar.description);
        var platform = '';
        if (user.last_platform === 'android') {
            platform = 'Android';
        } else if (user.last_platform === 'ios') {
            platform = 'iOS';
        } else if (user.inVRMode) {
            platform = 'VR';
        } else {
            platform = 'Desktop';
        }
        this.photonUserSusieCheck(photonId, user, gameLogDate);
        this.checkVRChatCache(avatar).then((cacheInfo) => {
            var inCache = false;
            if (cacheInfo.Item1 > 0) {
                inCache = true;
            }
            this.addEntryPhotonEvent({
                photonId,
                text: 'has joined',
                type: 'OnPlayerJoined',
                created_at: gameLogDate,
                avatar,
                inCache,
                platform
            });
        });
    };

    $app.methods.photonUserSusieCheck = function (photonId, user, gameLogDate) {
        var text = '';
        if (typeof user.modTag !== 'undefined') {
            text = `Moderator has joined ${user.modTag}`;
        } else if (user.isInvisible) {
            text = 'User joined invisible';
        }
        if (text) {
            this.addEntryPhotonEvent({
                photonId,
                text,
                type: 'Event',
                color: 'yellow',
                created_at: gameLogDate
            });
            var entry = {
                created_at: new Date().toJSON(),
                type: 'Event',
                data: `${text} - ${this.getDisplayNameFromPhotonId(
                    photonId
                )} (${this.getUserIdFromPhotonId(photonId)})`
            };
            this.queueGameLogNoty(entry);
            this.addGameLog(entry);
            database.addGamelogEventToDatabase(entry);
        }
    };

    $app.methods.photonUserLeave = function (photonId, gameLogDate) {
        if (!this.photonLobbyCurrent.has(photonId)) {
            return;
        }
        var text = 'has left';
        var lastEvent = this.photonEvent7List.get(parseInt(photonId, 10));
        if (typeof lastEvent !== 'undefined') {
            var timeSinceLastEvent = Date.now() - Date.parse(lastEvent);
            if (timeSinceLastEvent > 10 * 1000) {
                // 10 seconds
                text = `has timed out after ${timeToText(timeSinceLastEvent)}`;
            }
        }
        this.photonLobbyActivePortals.forEach((portal) => {
            if (portal.pendingLeave > 0) {
                text = `has left through portal to "${portal.worldName}"`;
                portal.pendingLeave--;
            }
        });
        this.addEntryPhotonEvent({
            photonId,
            text,
            type: 'OnPlayerLeft',
            created_at: gameLogDate
        });
    };

    $app.methods.photonModerationUpdate = function (
        ref,
        photonId,
        block,
        mute,
        gameLogDate
    ) {
        database.getModeration(ref.id).then((row) => {
            var lastType = this.photonLobbyLastModeration.get(photonId);
            var type = '';
            var text = '';
            if (block) {
                type = 'Blocked';
                text = 'Blocked';
            } else if (mute) {
                type = 'Muted';
                text = 'Muted';
            }
            if (row.userId) {
                if (!block && row.block) {
                    type = 'Unblocked';
                    text = 'Unblocked';
                } else if (!mute && row.mute) {
                    type = 'Unmuted';
                    text = 'Unmuted';
                }
                if (block === row.block && mute === row.mute) {
                    // no change
                    if (type && type !== lastType) {
                        this.addEntryPhotonEvent({
                            photonId,
                            text: `Moderation ${text}`,
                            type: 'Moderation',
                            color: 'yellow',
                            created_at: gameLogDate
                        });
                    }
                    this.photonLobbyLastModeration.set(photonId, type);
                    return;
                }
            }
            this.photonLobbyLastModeration.set(photonId, type);
            this.moderationAgainstTable.forEach((item) => {
                if (item.userId === ref.id && item.type === type) {
                    removeFromArray(this.moderationAgainstTable, item);
                }
            });
            if (type) {
                this.addEntryPhotonEvent({
                    photonId,
                    text: `Moderation ${text}`,
                    type: 'Moderation',
                    color: 'yellow',
                    created_at: gameLogDate
                });
                var noty = {
                    created_at: new Date().toJSON(),
                    userId: ref.id,
                    displayName: ref.displayName,
                    type
                };
                this.queueModerationNoty(noty);
                var entry = {
                    created_at: gameLogDate,
                    userId: ref.id,
                    displayName: ref.displayName,
                    type
                };
                this.moderationAgainstTable.push(entry);
            }
            if (block || mute || block !== row.block || mute !== row.mute) {
                this.updateSharedFeed(true);
            }
            if (block || mute) {
                database.setModeration({
                    userId: ref.id,
                    updatedAt: gameLogDate,
                    displayName: ref.displayName,
                    block,
                    mute
                });
            } else if (row.block || row.mute) {
                database.deleteModeration(ref.id);
            }
        });
    };

    $app.methods.parsePhotonAvatarChange = function (
        photonId,
        user,
        avatar,
        gameLogDate
    ) {
        if (typeof avatar === 'undefined') {
            return;
        }
        if (typeof user === 'undefined') {
            console.error('PhotonAvatarChange: user is undefined', photonId);
            return;
        }
        var oldAvatarId = this.photonLobbyAvatars.get(user.id);
        if (
            oldAvatarId &&
            oldAvatarId !== avatar.id &&
            photonId !== this.photonLobbyCurrentUser
        ) {
            avatar.name = this.replaceBioSymbols(avatar.name);
            avatar.description = this.replaceBioSymbols(avatar.description);
            this.checkVRChatCache(avatar).then((cacheInfo) => {
                var inCache = false;
                if (cacheInfo.Item1 > 0) {
                    inCache = true;
                }
                var entry = {
                    created_at: new Date().toJSON(),
                    type: 'AvatarChange',
                    userId: user.id,
                    displayName: user.displayName,
                    name: avatar.name,
                    description: avatar.description,
                    avatarId: avatar.id,
                    authorId: avatar.authorId,
                    releaseStatus: avatar.releaseStatus,
                    imageUrl: avatar.imageUrl,
                    thumbnailImageUrl: avatar.thumbnailImageUrl
                };
                this.queueGameLogNoty(entry);
                this.addGameLog(entry);
                this.addEntryPhotonEvent({
                    photonId,
                    displayName: user.displayName,
                    userId: user.id,
                    text: `ChangeAvatar ${avatar.name}`,
                    type: 'ChangeAvatar',
                    created_at: gameLogDate,
                    avatar,
                    inCache
                });
            });
        }
        this.photonLobbyAvatars.set(user.id, avatar.id);
    };

    $app.methods.parsePhotonGroupChange = async function (
        photonId,
        user,
        groupId,
        gameLogDate
    ) {
        if (
            typeof user === 'undefined' ||
            !this.photonLobbyJointime.has(photonId)
        ) {
            return;
        }
        var { groupOnNameplate } = this.photonLobbyJointime.get(photonId);
        if (
            typeof groupOnNameplate !== 'undefined' &&
            groupOnNameplate !== groupId &&
            photonId !== this.photonLobbyCurrentUser
        ) {
            var groupName = await this.getGroupName(groupId);
            var previousGroupName = await this.getGroupName(groupOnNameplate);
            this.addEntryPhotonEvent({
                photonId,
                displayName: user.displayName,
                userId: user.id,
                text: `ChangeGroup ${groupName}`,
                type: 'ChangeGroup',
                created_at: gameLogDate,
                groupId,
                groupName,
                previousGroupId: groupOnNameplate,
                previousGroupName
            });
        }
    };

    $app.methods.parsePhotonAvatar = function (avatar) {
        if (typeof avatar === 'undefined' || typeof avatar.id === 'undefined') {
            console.error('PhotonAvatar: avatar is undefined');
            return;
        }
        var tags = [];
        var unityPackages = [];
        if (typeof avatar.tags !== 'undefined') {
            tags = avatar.tags;
        }
        if (typeof avatar.unityPackages !== 'undefined') {
            unityPackages = avatar.unityPackages;
        }
        if (!avatar.assetUrl && unityPackages.length > 0) {
            for (var unityPackage of unityPackages) {
                if (
                    unityPackage.variant &&
                    unityPackage.variant !== 'standard'
                ) {
                    continue;
                }
                if (unityPackage.platform === 'standalonewindows') {
                    avatar.assetUrl = unityPackage.assetUrl;
                }
            }
        }
        API.applyAvatar({
            id: avatar.id,
            authorId: avatar.authorId,
            authorName: avatar.authorName,
            updated_at: avatar.updated_at,
            description: avatar.description,
            imageUrl: avatar.imageUrl,
            thumbnailImageUrl: avatar.thumbnailImageUrl,
            name: avatar.name,
            releaseStatus: avatar.releaseStatus,
            version: avatar.version,
            tags,
            unityPackages
        });
    };

    $app.methods.addGameLogVideo = async function (gameLog, location, userId) {
        var videoUrl = gameLog.videoUrl;
        var youtubeVideoId = '';
        var videoId = '';
        var videoName = '';
        var videoLength = '';
        var displayName = '';
        var videoPos = 8; // video loading delay
        if (typeof gameLog.displayName !== 'undefined') {
            displayName = gameLog.displayName;
        }
        if (typeof gameLog.videoPos !== 'undefined') {
            videoPos = gameLog.videoPos;
        }
        if (!this.isRpcWorld(location) || gameLog.videoId === 'YouTube') {
            // skip PyPyDance and VRDancing videos
            try {
                var url = new URL(videoUrl);
                if (
                    url.origin === 'https://t-ne.x0.to' ||
                    url.origin === 'https://nextnex.com' ||
                    url.origin === 'https://r.0cm.org'
                ) {
                    url = new URL(url.searchParams.get('url'));
                }
                if (videoUrl.startsWith('https://u2b.cx/')) {
                    url = new URL(videoUrl.substring(15));
                }
                var id1 = url.pathname;
                var id2 = url.searchParams.get('v');
                if (id1 && id1.length === 12) {
                    // https://youtu.be/
                    youtubeVideoId = id1.substring(1, 12);
                }
                if (id1 && id1.length === 19) {
                    // https://www.youtube.com/shorts/
                    youtubeVideoId = id1.substring(8, 19);
                }
                if (id2 && id2.length === 11) {
                    // https://www.youtube.com/watch?v=
                    // https://music.youtube.com/watch?v=
                    youtubeVideoId = id2;
                }
                if (this.youTubeApi && youtubeVideoId) {
                    var data = await this.lookupYouTubeVideo(youtubeVideoId);
                    if (data || data.pageInfo.totalResults !== 0) {
                        videoId = 'YouTube';
                        videoName = data.items[0].snippet.title;
                        videoLength = this.convertYoutubeTime(
                            data.items[0].contentDetails.duration
                        );
                    }
                }
            } catch {
                console.error(`Invalid URL: ${url}`);
            }
            var entry = {
                created_at: gameLog.dt,
                type: 'VideoPlay',
                videoUrl,
                videoId,
                videoName,
                videoLength,
                location,
                displayName,
                userId,
                videoPos
            };
            this.setNowPlaying(entry);
        }
    };

    $app.methods.addGameLogPyPyDance = function (gameLog, location) {
        var data =
            /VideoPlay\(PyPyDance\) "(.+?)",([\d.]+),([\d.]+),"(.*)"/g.exec(
                gameLog.data
            );
        if (!data) {
            console.error('failed to parse', gameLog.data);
            return;
        }
        var videoUrl = data[1];
        var videoPos = Number(data[2]);
        var videoLength = Number(data[3]);
        var title = data[4];
        var bracketArray = title.split('(');
        var text1 = bracketArray.pop();
        var displayName = text1.slice(0, -1);
        var text2 = bracketArray.join('(');
        if (text2 === 'URL ') {
            var videoId = 'YouTube';
        } else {
            var videoId = text2.substr(0, text2.indexOf(':') - 1);
            text2 = text2.substr(text2.indexOf(':') + 2);
        }
        var videoName = text2.slice(0, -1);
        if (displayName === 'Random') {
            displayName = '';
        }
        if (videoUrl === this.nowPlaying.url) {
            var entry = {
                created_at: gameLog.dt,
                videoUrl,
                videoLength,
                videoPos
            };
            this.setNowPlaying(entry);
            return;
        }
        var userId = '';
        if (displayName) {
            for (var ref of API.cachedUsers.values()) {
                if (ref.displayName === displayName) {
                    userId = ref.id;
                    break;
                }
            }
        }
        if (videoId === 'YouTube') {
            var entry = {
                dt: gameLog.dt,
                videoUrl,
                displayName,
                videoPos,
                videoId
            };
            this.addGameLogVideo(entry, location, userId);
        } else {
            var entry = {
                created_at: gameLog.dt,
                type: 'VideoPlay',
                videoUrl,
                videoId,
                videoName,
                videoLength,
                location,
                displayName,
                userId,
                videoPos
            };
            this.setNowPlaying(entry);
        }
    };

    $app.methods.addGameLogVRDancing = function (gameLog, location) {
        var data =
            /VideoPlay\(VRDancing\) "(.+?)",([\d.]+),([\d.]+),(-?[\d.]+),"(.+?)","(.+?)"/g.exec(
                gameLog.data
            );
        if (!data) {
            console.error('failed to parse', gameLog.data);
            return;
        }
        var videoUrl = data[1];
        var videoPos = Number(data[2]);
        var videoLength = Number(data[3]);
        var videoId = Number(data[4]);
        var displayName = data[5];
        var videoName = data[6];
        if (videoId === -1) {
            videoId = 'YouTube';
        }
        if (parseInt(videoPos, 10) === parseInt(videoLength, 10)) {
            // ummm okay
            videoPos = 0;
        }
        if (videoUrl === this.nowPlaying.url) {
            var entry = {
                created_at: gameLog.dt,
                videoUrl,
                videoLength,
                videoPos
            };
            this.setNowPlaying(entry);
            return;
        }
        var userId = '';
        if (displayName) {
            for (var ref of API.cachedUsers.values()) {
                if (ref.displayName === displayName) {
                    userId = ref.id;
                    break;
                }
            }
        }
        if (videoId === 'YouTube') {
            var entry = {
                dt: gameLog.dt,
                videoUrl,
                displayName,
                videoPos,
                videoId
            };
            this.addGameLogVideo(entry, location, userId);
        } else {
            var entry = {
                created_at: gameLog.dt,
                type: 'VideoPlay',
                videoUrl,
                videoId,
                videoName,
                videoLength,
                location,
                displayName,
                userId,
                videoPos
            };
            this.setNowPlaying(entry);
        }
    };

    $app.methods.addGameLogZuwaZuwaDance = function (gameLog, location) {
        var data =
            /VideoPlay\(ZuwaZuwaDance\) "(.+?)",([\d.]+),([\d.]+),(-?[\d.]+),"(.+?)","(.+?)"/g.exec(
                gameLog.data
            );
        if (!data) {
            console.error('failed to parse', gameLog.data);
            return;
        }
        var videoUrl = data[1];
        var videoPos = Number(data[2]);
        var videoLength = Number(data[3]);
        var videoId = Number(data[4]);
        var displayName = data[5];
        var videoName = data[6];
        if (displayName === 'Random') {
            displayName = '';
        }
        if (videoId === 9999) {
            videoId = 'YouTube';
        }
        if (videoUrl === this.nowPlaying.url) {
            var entry = {
                created_at: gameLog.dt,
                videoUrl,
                videoLength,
                videoPos
            };
            this.setNowPlaying(entry);
            return;
        }
        var userId = '';
        if (displayName) {
            for (var ref of API.cachedUsers.values()) {
                if (ref.displayName === displayName) {
                    userId = ref.id;
                    break;
                }
            }
        }
        if (videoId === 'YouTube') {
            var entry = {
                dt: gameLog.dt,
                videoUrl,
                displayName,
                videoPos,
                videoId
            };
            this.addGameLogVideo(entry, location, userId);
        } else {
            var entry = {
                created_at: gameLog.dt,
                type: 'VideoPlay',
                videoUrl,
                videoId,
                videoName,
                videoLength,
                location,
                displayName,
                userId,
                videoPos
            };
            this.setNowPlaying(entry);
        }
    };

    $app.methods.addGameLogLSMedia = function (gameLog, location) {
        // [VRCX] LSMedia 0,4268.981,Natsumi-sama,,
        // [VRCX] LSMedia 0,6298.292,Natsumi-sama,The Outfit (2022), 1080p
        var data = /LSMedia ([\d.]+),([\d.]+),(.+?),(.+?),(?=[^,]*$)/g.exec(
            gameLog.data
        );
        if (!data) {
            return;
        }
        var videoPos = Number(data[1]);
        var videoLength = Number(data[2]);
        var displayName = data[3];
        var videoName = this.replaceBioSymbols(data[4]);
        var videoUrl = videoName;
        var videoId = 'LSMedia';
        if (videoUrl === this.nowPlaying.url) {
            var entry = {
                created_at: gameLog.dt,
                videoUrl,
                videoLength,
                videoPos
            };
            this.setNowPlaying(entry);
            return;
        }
        var userId = '';
        if (displayName) {
            for (var ref of API.cachedUsers.values()) {
                if (ref.displayName === displayName) {
                    userId = ref.id;
                    break;
                }
            }
        }
        var entry = {
            created_at: gameLog.dt,
            type: 'VideoPlay',
            videoUrl,
            videoId,
            videoName,
            videoLength,
            location,
            displayName,
            userId,
            videoPos
        };
        this.setNowPlaying(entry);
    };

    $app.methods.addGameLogMovieAndChill = function (gameLog, location) {
        // [VRCX] Movie&Chill CurrentTime,Length,PlayerName,MovieName
        var data = /Movie&Chill ([\d.]+),([\d.]+),(.+?),(.*)/g.exec(
            gameLog.data
        );
        if (!data) {
            return;
        }
        var videoPos = Number(data[1]);
        var videoLength = Number(data[2]);
        var displayName = data[3];
        var videoName = data[4];
        var videoUrl = videoName;
        var videoId = 'Movie&Chill';
        if (!videoName) {
            return;
        }
        if (videoUrl === this.nowPlaying.url) {
            var entry = {
                created_at: gameLog.dt,
                videoUrl,
                videoLength,
                videoPos
            };
            this.setNowPlaying(entry);
            return;
        }
        var userId = '';
        if (displayName) {
            for (var ref of API.cachedUsers.values()) {
                if (ref.displayName === displayName) {
                    userId = ref.id;
                    break;
                }
            }
        }
        var entry = {
            created_at: gameLog.dt,
            type: 'VideoPlay',
            videoUrl,
            videoId,
            videoName,
            videoLength,
            location,
            displayName,
            userId,
            videoPos
        };
        this.setNowPlaying(entry);
    };

    $app.methods.lookupYouTubeVideo = async function (videoId) {
        var data = null;
        var apiKey = 'AIzaSyDC9AwAmtnMWpmk6mhs-iIStfXmH0vJxew';
        if (this.youTubeApiKey) {
            apiKey = this.youTubeApiKey;
        }
        try {
            var response = await webApiService.execute({
                url: `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(
                    videoId
                )}&part=snippet,contentDetails&key=${apiKey}`,
                method: 'GET',
                headers: {
                    Referer: 'https://vrcx.pypy.moe'
                }
            });
            var json = JSON.parse(response.data);
            if (this.debugWebRequests) {
                console.log(json, response);
            }
            if (response.status === 200) {
                data = json;
            } else {
                throw new Error(`Error: ${response.data}`);
            }
        } catch {
            console.error(`YouTube video lookup failed for ${videoId}`);
        }
        return data;
    };

    $app.data.nowPlaying = {
        url: '',
        name: '',
        length: 0,
        startTime: 0,
        offset: 0,
        elapsed: 0,
        percentage: 0,
        remainingText: '',
        playing: false
    };

    $app.methods.clearNowPlaying = function () {
        this.nowPlaying = {
            url: '',
            name: '',
            length: 0,
            startTime: 0,
            offset: 0,
            elapsed: 0,
            percentage: 0,
            remainingText: '',
            playing: false
        };
        this.updateVrNowPlaying();
    };

    $app.methods.setNowPlaying = function (ctx) {
        if (this.nowPlaying.url !== ctx.videoUrl) {
            this.queueGameLogNoty(ctx);
            this.addGameLog(ctx);
            database.addGamelogVideoPlayToDatabase(ctx);

            var displayName = '';
            if (ctx.displayName) {
                displayName = ` (${ctx.displayName})`;
            }
            var name = `${ctx.videoName}${displayName}`;
            this.nowPlaying = {
                url: ctx.videoUrl,
                name,
                length: ctx.videoLength,
                startTime: Date.parse(ctx.created_at) / 1000,
                offset: ctx.videoPos,
                elapsed: 0,
                percentage: 0,
                remainingText: ''
            };
        } else {
            this.nowPlaying = {
                ...this.nowPlaying,
                length: ctx.videoLength,
                startTime: Date.parse(ctx.created_at) / 1000,
                offset: ctx.videoPos,
                elapsed: 0,
                percentage: 0,
                remainingText: ''
            };
        }
        this.updateVrNowPlaying();
        if (!this.nowPlaying.playing && ctx.videoLength > 0) {
            this.nowPlaying.playing = true;
            this.updateNowPlaying();
        }
    };

    $app.methods.updateNowPlaying = function () {
        var np = this.nowPlaying;
        if (!this.nowPlaying.playing) {
            return;
        }
        var now = Date.now() / 1000;
        np.elapsed = Math.round((now - np.startTime + np.offset) * 10) / 10;
        if (np.elapsed >= np.length) {
            this.clearNowPlaying();
            return;
        }
        np.remainingText = this.formatSeconds(np.length - np.elapsed);
        np.percentage = Math.round(((np.elapsed * 100) / np.length) * 10) / 10;
        this.updateVrNowPlaying();
        workerTimers.setTimeout(() => this.updateNowPlaying(), 1000);
    };

    $app.methods.updateVrNowPlaying = function () {
        var json = JSON.stringify(this.nowPlaying);
        AppApi.ExecuteVrFeedFunction('nowPlayingUpdate', json);
        AppApi.ExecuteVrOverlayFunction('nowPlayingUpdate', json);
    };

    $app.methods.formatSeconds = function (duration) {
        var pad = function (num, size) {
                return `000${num}`.slice(size * -1);
            },
            time = parseFloat(duration).toFixed(3),
            hours = Math.floor(time / 60 / 60),
            minutes = Math.floor(time / 60) % 60,
            seconds = Math.floor(time - minutes * 60);
        var hoursOut = '';
        if (hours > '0') {
            hoursOut = `${pad(hours, 2)}:`;
        }
        return `${hoursOut + pad(minutes, 2)}:${pad(seconds, 2)}`;
    };

    $app.methods.convertYoutubeTime = function (duration) {
        var a = duration.match(/\d+/g);
        if (
            duration.indexOf('M') >= 0 &&
            duration.indexOf('H') === -1 &&
            duration.indexOf('S') === -1
        ) {
            a = [0, a[0], 0];
        }
        if (duration.indexOf('H') >= 0 && duration.indexOf('M') === -1) {
            a = [a[0], 0, a[1]];
        }
        if (
            duration.indexOf('H') >= 0 &&
            duration.indexOf('M') === -1 &&
            duration.indexOf('S') === -1
        ) {
            a = [a[0], 0, 0];
        }
        var length = 0;
        if (a.length === 3) {
            length += parseInt(a[0], 10) * 3600;
            length += parseInt(a[1], 10) * 60;
            length += parseInt(a[2], 10);
        }
        if (a.length === 2) {
            length += parseInt(a[0], 10) * 60;
            length += parseInt(a[1], 10);
        }
        if (a.length === 1) {
            length += parseInt(a[0], 10);
        }
        return length;
    };

    $app.methods.updateDiscord = function () {
        var currentLocation = this.lastLocation.location;
        var timeStamp = this.lastLocation.date;
        if (this.lastLocation.location === 'traveling') {
            currentLocation = this.lastLocationDestination;
            timeStamp = this.lastLocationDestinationTime;
        }
        if (
            !this.discordActive ||
            !this.isGameRunning ||
            (!currentLocation && !this.lastLocation$.tag)
        ) {
            this.setDiscordActive(false);
            return;
        }
        this.setDiscordActive(true);
        var L = this.lastLocation$;
        if (currentLocation !== this.lastLocation$.tag) {
            Discord.SetTimestamps(timeStamp, 0);
            L = API.parseLocation(currentLocation);
            L.worldName = '';
            L.thumbnailImageUrl = '';
            L.worldCapacity = 0;
            L.joinUrl = '';
            L.accessName = '';
            if (L.worldId) {
                var ref = API.cachedWorlds.get(L.worldId);
                if (ref) {
                    L.worldName = ref.name;
                    L.thumbnailImageUrl = ref.thumbnailImageUrl;
                    L.worldCapacity = ref.capacity;
                } else {
                    API.getWorld({
                        worldId: L.worldId
                    }).then((args) => {
                        L.worldName = args.ref.name;
                        L.thumbnailImageUrl = args.ref.thumbnailImageUrl;
                        L.worldCapacity = args.ref.capacity;
                        return args;
                    });
                }
                if (this.isGameNoVR) {
                    var platform = 'Desktop';
                } else {
                    var platform = 'VR';
                }
                var groupAccessType = '';
                if (L.groupAccessType) {
                    if (L.groupAccessType === 'public') {
                        groupAccessType = 'Public';
                    } else if (L.groupAccessType === 'plus') {
                        groupAccessType = 'Plus';
                    }
                }
                switch (L.accessType) {
                    case 'public':
                        L.joinUrl = this.getLaunchURL(L);
                        L.accessName = `Public #${L.instanceName} (${platform})`;
                        break;
                    case 'invite+':
                        L.accessName = `Invite+ #${L.instanceName} (${platform})`;
                        break;
                    case 'invite':
                        L.accessName = `Invite #${L.instanceName} (${platform})`;
                        break;
                    case 'friends':
                        L.accessName = `Friends #${L.instanceName} (${platform})`;
                        break;
                    case 'friends+':
                        L.accessName = `Friends+ #${L.instanceName} (${platform})`;
                        break;
                    case 'group':
                        L.accessName = `Group #${L.instanceName} (${platform})`;
                        this.getGroupName(L.groupId).then((groupName) => {
                            if (groupName) {
                                L.accessName = `Group${groupAccessType}(${groupName}) #${L.instanceName} (${platform})`;
                            }
                        });
                        break;
                }
            }
            this.lastLocation$ = L;
        }
        var hidePrivate = false;
        // (L.accessType === 'group' && !L.groupAccessType) || L.groupAccessType === 'member')
        if (
            this.discordHideInvite &&
            (L.accessType === 'invite' || L.accessType === 'invite+')
        ) {
            hidePrivate = true;
        }
        switch (API.currentUser.status) {
            case 'active':
                L.statusName = 'Online';
                L.statusImage = 'active';
                break;
            case 'join me':
                L.statusName = 'Join Me';
                L.statusImage = 'joinme';
                break;
            case 'ask me':
                L.statusName = 'Ask Me';
                L.statusImage = 'askme';
                if (this.discordHideInvite) {
                    hidePrivate = true;
                }
                break;
            case 'busy':
                L.statusName = 'Do Not Disturb';
                L.statusImage = 'busy';
                hidePrivate = true;
                break;
        }
        var appId = '883308884863901717';
        var bigIcon = 'vrchat';
        var partyId = `${L.worldId}:${L.instanceName}`;
        var partySize = this.lastLocation.playerList.size;
        var partyMaxSize = L.worldCapacity;
        if (partySize > partyMaxSize) {
            partyMaxSize = partySize;
        }
        var buttonText = 'Join';
        var buttonUrl = L.joinUrl;
        if (!this.discordJoinButton) {
            buttonText = '';
            buttonUrl = '';
        }
        if (!this.discordInstance) {
            partySize = 0;
            partyMaxSize = 0;
        }
        if (hidePrivate) {
            partyId = '';
            partySize = 0;
            partyMaxSize = 0;
            buttonText = '';
            buttonUrl = '';
        } else if (this.isRpcWorld(L.tag)) {
            // custom world rpc
            if (
                L.worldId === 'wrld_f20326da-f1ac-45fc-a062-609723b097b1' ||
                L.worldId === 'wrld_10e5e467-fc65-42ed-8957-f02cace1398c' ||
                L.worldId === 'wrld_04899f23-e182-4a8d-b2c7-2c74c7c15534'
            ) {
                appId = '784094509008551956';
                bigIcon = 'pypy';
            } else if (
                L.worldId === 'wrld_42377cf1-c54f-45ed-8996-5875b0573a83' ||
                L.worldId === 'wrld_dd6d2888-dbdc-47c2-bc98-3d631b2acd7c'
            ) {
                appId = '846232616054030376';
                bigIcon = 'vr_dancing';
            } else if (
                L.worldId === 'wrld_52bdcdab-11cd-4325-9655-0fb120846945' ||
                L.worldId === 'wrld_2d40da63-8f1f-4011-8a9e-414eb8530acd'
            ) {
                appId = '939473404808007731';
                bigIcon = 'zuwa_zuwa_dance';
            } else if (
                L.worldId === 'wrld_1b68f7a8-8aea-4900-b7a2-3fc4139ac817' ||
                L.worldId === 'wrld_db9d878f-6e76-4776-8bf2-15bcdd7fc445' ||
                L.worldId === 'wrld_435bbf25-f34f-4b8b-82c6-cd809057eb8e'
            ) {
                appId = '968292722391785512';
                bigIcon = 'ls_media';
            } else if (
                L.worldId === 'wrld_791ebf58-54ce-4d3a-a0a0-39f10e1b20b2' ||
                L.worldId === 'wrld_86a09fce-a34e-4deb-81be-53c843f97e98'
            ) {
                appId = '1095440531821170820';
                bigIcon = 'movie_and_chill';
            }
            if (this.nowPlaying.name) {
                L.worldName = this.nowPlaying.name;
            }
            if (this.nowPlaying.playing) {
                Discord.SetTimestamps(
                    Date.now(),
                    (this.nowPlaying.startTime -
                        this.nowPlaying.offset +
                        this.nowPlaying.length) *
                        1000
                );
            }
        } else if (!this.discordHideImage && L.thumbnailImageUrl) {
            bigIcon = L.thumbnailImageUrl;
        }
        Discord.SetAssets(
            bigIcon, // big icon
            'Powered by VRCX', // big icon hover text
            L.statusImage, // small icon
            L.statusName, // small icon hover text
            partyId, // party id
            partySize, // party size
            partyMaxSize, // party max size
            buttonText, // button text
            buttonUrl, // button url
            appId // app id
        );
        // NOTE
        // 글자 수가 짧으면 업데이트가 안된다..
        if (L.worldName.length < 2) {
            L.worldName += '\uFFA0'.repeat(2 - L.worldName.length);
        }
        if (hidePrivate) {
            Discord.SetText('Private', '');
            Discord.SetTimestamps(0, 0);
        } else if (this.discordInstance) {
            Discord.SetText(L.worldName, L.accessName);
        } else {
            Discord.SetText(L.worldName, '');
        }
    };

    $app.methods.setDiscordActive = async function (active) {
        if (active !== this.isDiscordActive) {
            this.isDiscordActive = await Discord.SetActive(active);
        }
    };

    $app.methods.updateAutoStateChange = function () {
        if (
            this.autoStateChange === 'Off' ||
            !this.isGameRunning ||
            !this.lastLocation.playerList.size ||
            this.lastLocation.location === '' ||
            this.lastLocation.location === 'traveling'
        ) {
            return;
        }

        const otherPeopleExists = this.lastLocation.playerList.size > 1;
        const prevStatus = API.currentUser.status;
        let nextStatus = prevStatus;

        switch (this.autoStateChange) {
            case 'Active or Ask Me':
                nextStatus = otherPeopleExists ? 'ask me' : 'active';
                break;

            case 'Active or Busy':
                nextStatus = otherPeopleExists ? 'busy' : 'active';
                break;

            case 'Join Me or Ask Me':
                nextStatus = otherPeopleExists ? 'ask me' : 'join me';
                break;

            case 'Join Me or Busy':
                nextStatus = otherPeopleExists ? 'busy' : 'join me';
                break;

            case 'Ask Me or Busy':
                nextStatus = otherPeopleExists ? 'ask me' : 'busy';
                break;
        }

        if (prevStatus === nextStatus) {
            return;
        }

        API.saveCurrentUser({
            status: nextStatus
        });
    };

    $app.methods.lookupUser = async function (ref) {
        if (ref.userId) {
            this.showUserDialog(ref.userId);
            return;
        }
        if (!ref.displayName || ref.displayName.substring(0, 3) === 'ID:') {
            return;
        }
        for (var ctx of API.cachedUsers.values()) {
            if (ctx.displayName === ref.displayName) {
                this.showUserDialog(ctx.id);
                return;
            }
        }
        this.searchText = ref.displayName;
        await this.searchUserByDisplayName(ref.displayName);
        for (var ctx of this.searchUserResults) {
            if (ctx.displayName === ref.displayName) {
                this.searchText = '';
                this.clearSearch();
                this.showUserDialog(ctx.id);
                return;
            }
        }
        this.$refs.searchTab.currentName = '0';
        this.$refs.menu.activeIndex = 'search';
    };

    // #endregion
    // #region | App: Search

    $app.data.searchText = '';
    $app.data.searchUserResults = [];
    $app.data.searchUserParams = {};
    $app.data.searchWorldResults = [];
    $app.data.searchWorldOption = '';
    $app.data.searchWorldParams = {};
    $app.data.searchAvatarResults = [];
    $app.data.searchAvatarPage = [];
    $app.data.searchAvatarPageNum = 0;
    $app.data.searchAvatarFilter = '';
    $app.data.searchAvatarSort = '';
    $app.data.searchAvatarFilterRemote = '';
    $app.data.searchGroupResults = [];
    $app.data.searchGroupParams = {};
    $app.data.isSearchUserLoading = false;
    $app.data.isSearchWorldLoading = false;
    $app.data.isSearchAvatarLoading = false;
    $app.data.isSearchGroupLoading = false;

    API.$on('LOGIN', function () {
        $app.searchText = '';
        $app.searchUserResults = [];
        $app.searchUserParams = {};
        $app.searchWorldResults = [];
        $app.searchWorldOption = '';
        $app.searchWorldParams = {};
        $app.searchAvatarResults = [];
        $app.searchAvatarPage = [];
        $app.searchAvatarPageNum = 0;
        $app.searchAvatarFilter = '';
        $app.searchAvatarSort = '';
        $app.searchAvatarFilterRemote = '';
        $app.searchGroupResults = [];
        $app.searchGroupParams = {};
        $app.isSearchUserLoading = false;
        $app.isSearchWorldLoading = false;
        $app.isSearchAvatarLoading = false;
    });

    $app.methods.clearSearch = function () {
        this.searchText = '';
        this.searchUserParams = {};
        this.searchWorldParams = {};
        this.searchUserResults = [];
        this.searchWorldResults = [];
        this.searchAvatarResults = [];
        this.searchAvatarPage = [];
        this.searchAvatarPageNum = 0;
        this.searchGroupParams = {};
        this.searchGroupResults = [];
    };

    $app.methods.search = function () {
        switch (this.$refs.searchTab.currentName) {
            case '0':
                this.searchUser();
                break;
            case '1':
                this.searchWorld({});
                break;
            case '2':
                this.searchAvatar();
                break;
            case '3':
                this.searchGroup();
                break;
        }
    };

    $app.methods.searchUserByDisplayName = async function (displayName) {
        this.searchUserParams = {
            n: 10,
            offset: 0,
            fuzzy: false,
            search: displayName
        };
        await this.moreSearchUser();
    };

    $app.methods.searchUser = async function () {
        this.searchUserParams = {
            n: 10,
            offset: 0,
            search: this.searchText
        };
        await this.moreSearchUser();
    };

    $app.methods.moreSearchUser = async function (go) {
        var params = this.searchUserParams;
        if (go) {
            params.offset += params.n * go;
            if (params.offset < 0) {
                params.offset = 0;
            }
        }
        this.isSearchUserLoading = true;
        await API.getUsers(params)
            .finally(() => {
                this.isSearchUserLoading = false;
            })
            .then((args) => {
                var map = new Map();
                for (var json of args.json) {
                    var ref = API.cachedUsers.get(json.id);
                    if (typeof ref !== 'undefined') {
                        map.set(ref.id, ref);
                    }
                }
                this.searchUserResults = Array.from(map.values());
                return args;
            });
    };

    $app.data.searchWorldLabs = false;

    $app.methods.searchWorld = function (ref) {
        this.searchWorldOption = '';
        var params = {
            n: 10,
            offset: 0
        };
        switch (ref.sortHeading) {
            case 'featured':
                params.sort = 'order';
                params.featured = 'true';
                break;
            case 'trending':
                params.sort = 'popularity';
                params.featured = 'false';
                break;
            case 'updated':
                params.sort = 'updated';
                break;
            case 'created':
                params.sort = 'created';
                break;
            case 'publication':
                params.sort = 'publicationDate';
                break;
            case 'shuffle':
                params.sort = 'shuffle';
                break;
            case 'active':
                this.searchWorldOption = 'active';
                break;
            case 'recent':
                this.searchWorldOption = 'recent';
                break;
            case 'favorite':
                this.searchWorldOption = 'favorites';
                break;
            case 'labs':
                params.sort = 'labsPublicationDate';
                break;
            case 'heat':
                params.sort = 'heat';
                params.featured = 'false';
                break;
            default:
                params.sort = 'relevance';
                params.search = this.replaceBioSymbols(this.searchText);
                break;
        }
        params.order = ref.sortOrder || 'descending';
        if (ref.sortOwnership === 'mine') {
            params.user = 'me';
            params.releaseStatus = 'all';
        }
        if (ref.tag) {
            params.tag = ref.tag;
        }
        if (!this.searchWorldLabs) {
            if (params.tag) {
                params.tag += ',system_approved';
            } else {
                params.tag = 'system_approved';
            }
        }
        // TODO: option.platform
        this.searchWorldParams = params;
        this.moreSearchWorld();
    };

    $app.methods.moreSearchWorld = function (go) {
        var params = this.searchWorldParams;
        if (go) {
            params.offset += params.n * go;
            if (params.offset < 0) {
                params.offset = 0;
            }
        }
        this.isSearchWorldLoading = true;
        API.getWorlds(params, this.searchWorldOption)
            .finally(() => {
                this.isSearchWorldLoading = false;
            })
            .then((args) => {
                var map = new Map();
                for (var json of args.json) {
                    var ref = API.cachedWorlds.get(json.id);
                    if (typeof ref !== 'undefined') {
                        map.set(ref.id, ref);
                    }
                }
                this.searchWorldResults = Array.from(map.values());
                return args;
            });
    };

    $app.methods.searchAvatar = async function () {
        this.isSearchAvatarLoading = true;
        if (!this.searchAvatarFilter) {
            this.searchAvatarFilter = 'all';
        }
        if (!this.searchAvatarSort) {
            this.searchAvatarSort = 'name';
        }
        if (!this.searchAvatarFilterRemote) {
            this.searchAvatarFilterRemote = 'all';
        }
        if (this.searchAvatarFilterRemote !== 'local') {
            this.searchAvatarSort = 'name';
        }
        var avatars = new Map();
        var query = this.searchText.toUpperCase();
        if (!query) {
            for (var ref of API.cachedAvatars.values()) {
                switch (this.searchAvatarFilter) {
                    case 'all':
                        avatars.set(ref.id, ref);
                        break;
                    case 'public':
                        if (ref.releaseStatus === 'public') {
                            avatars.set(ref.id, ref);
                        }
                        break;
                    case 'private':
                        if (ref.releaseStatus === 'private') {
                            avatars.set(ref.id, ref);
                        }
                        break;
                }
            }
            this.isSearchAvatarLoading = false;
        } else {
            if (
                this.searchAvatarFilterRemote === 'all' ||
                this.searchAvatarFilterRemote === 'local'
            ) {
                for (var ref of API.cachedAvatars.values()) {
                    var match = ref.name.toUpperCase().includes(query);
                    if (!match && ref.description) {
                        match = ref.description.toUpperCase().includes(query);
                    }
                    if (!match && ref.authorName) {
                        match = ref.authorName.toUpperCase().includes(query);
                    }
                    if (match) {
                        switch (this.searchAvatarFilter) {
                            case 'all':
                                avatars.set(ref.id, ref);
                                break;
                            case 'public':
                                if (ref.releaseStatus === 'public') {
                                    avatars.set(ref.id, ref);
                                }
                                break;
                            case 'private':
                                if (ref.releaseStatus === 'private') {
                                    avatars.set(ref.id, ref);
                                }
                                break;
                        }
                    }
                }
            }
            if (
                (this.searchAvatarFilterRemote === 'all' ||
                    this.searchAvatarFilterRemote === 'remote') &&
                this.avatarRemoteDatabase &&
                query.length >= 3
            ) {
                var data = await this.lookupAvatars('search', query);
                if (data && typeof data === 'object') {
                    data.forEach((avatar) => {
                        avatars.set(avatar.id, avatar);
                    });
                }
            }
            this.isSearchAvatarLoading = false;
        }
        var avatarsArray = Array.from(avatars.values());
        if (this.searchAvatarFilterRemote === 'local') {
            switch (this.searchAvatarSort) {
                case 'updated':
                    avatarsArray.sort(compareByUpdatedAt);
                    break;
                case 'created':
                    avatarsArray.sort(compareByCreatedAt);
                    break;
                case 'name':
                    avatarsArray.sort(compareByName);
                    break;
            }
        }
        this.searchAvatarPageNum = 0;
        this.searchAvatarResults = avatarsArray;
        this.searchAvatarPage = avatarsArray.slice(0, 10);
    };

    $app.methods.moreSearchAvatar = function (n) {
        if (n === -1) {
            this.searchAvatarPageNum--;
            var offset = this.searchAvatarPageNum * 10;
        }
        if (n === 1) {
            this.searchAvatarPageNum++;
            var offset = this.searchAvatarPageNum * 10;
        }
        this.searchAvatarPage = this.searchAvatarResults.slice(
            offset,
            offset + 10
        );
    };

    $app.methods.searchGroup = async function () {
        this.searchGroupParams = {
            n: 10,
            offset: 0,
            query: this.replaceBioSymbols(this.searchText)
        };
        await this.moreSearchGroup();
    };

    $app.methods.moreSearchGroup = async function (go) {
        var params = this.searchGroupParams;
        if (go) {
            params.offset += params.n * go;
            if (params.offset < 0) {
                params.offset = 0;
            }
        }
        this.isSearchGroupLoading = true;
        await API.groupSearch(params)
            .finally(() => {
                this.isSearchGroupLoading = false;
            })
            .then((args) => {
                var map = new Map();
                for (var json of args.json) {
                    var ref = API.cachedGroups.get(json.id);
                    if (typeof ref !== 'undefined') {
                        map.set(ref.id, ref);
                    }
                }
                this.searchGroupResults = Array.from(map.values());
                return args;
            });
    };

    // #endregion
    // #region | App: Favorite

    $app.data.favoriteObjects = new Map();
    $app.data.favoriteFriends_ = [];
    $app.data.favoriteFriendsSorted = [];
    $app.data.favoriteWorlds_ = [];
    $app.data.favoriteWorldsSorted = [];
    $app.data.favoriteAvatars_ = [];
    $app.data.favoriteAvatarsSorted = [];
    $app.data.sortFavoriteFriends = false;
    $app.data.sortFavoriteWorlds = false;
    $app.data.sortFavoriteAvatars = false;

    API.$on('LOGIN', function () {
        $app.favoriteObjects.clear();
        $app.favoriteFriends_ = [];
        $app.favoriteFriendsSorted = [];
        $app.favoriteWorlds_ = [];
        $app.favoriteWorldsSorted = [];
        $app.favoriteAvatars_ = [];
        $app.favoriteAvatarsSorted = [];
        $app.sortFavoriteFriends = false;
        $app.sortFavoriteWorlds = false;
        $app.sortFavoriteAvatars = false;
    });

    API.$on('FAVORITE', function (args) {
        $app.applyFavorite(args.ref.type, args.ref.favoriteId, args.sortTop);
    });

    API.$on('FAVORITE:@DELETE', function (args) {
        $app.applyFavorite(args.ref.type, args.ref.favoriteId);
    });

    API.$on('USER', function (args) {
        $app.applyFavorite('friend', args.ref.id);
    });

    API.$on('WORLD', function (args) {
        $app.applyFavorite('world', args.ref.id);
    });

    API.$on('AVATAR', function (args) {
        $app.applyFavorite('avatar', args.ref.id);
    });

    $app.methods.applyFavorite = async function (type, objectId, sortTop) {
        var favorite = API.cachedFavoritesByObjectId.get(objectId);
        var ctx = this.favoriteObjects.get(objectId);
        if (typeof favorite !== 'undefined') {
            var isTypeChanged = false;
            if (typeof ctx === 'undefined') {
                ctx = {
                    id: objectId,
                    type,
                    groupKey: favorite.$groupKey,
                    ref: null,
                    name: '',
                    $selected: false
                };
                this.favoriteObjects.set(objectId, ctx);
                if (type === 'friend') {
                    var ref = API.cachedUsers.get(objectId);
                    if (typeof ref === 'undefined') {
                        ref = this.friendLog.get(objectId);
                        if (typeof ref !== 'undefined' && ref.displayName) {
                            ctx.name = ref.displayName;
                        }
                    } else {
                        ctx.ref = ref;
                        ctx.name = ref.displayName;
                    }
                } else if (type === 'world') {
                    var ref = API.cachedWorlds.get(objectId);
                    if (typeof ref !== 'undefined') {
                        ctx.ref = ref;
                        ctx.name = ref.name;
                    }
                } else if (type === 'avatar') {
                    var ref = API.cachedAvatars.get(objectId);
                    if (typeof ref !== 'undefined') {
                        ctx.ref = ref;
                        ctx.name = ref.name;
                    }
                }
                isTypeChanged = true;
            } else {
                if (ctx.type !== type) {
                    // WTF???
                    isTypeChanged = true;
                    if (type === 'friend') {
                        removeFromArray(this.favoriteFriends_, ctx);
                        removeFromArray(this.favoriteFriendsSorted, ctx);
                    } else if (type === 'world') {
                        removeFromArray(this.favoriteWorlds_, ctx);
                        removeFromArray(this.favoriteWorldsSorted, ctx);
                    } else if (type === 'avatar') {
                        removeFromArray(this.favoriteAvatars_, ctx);
                        removeFromArray(this.favoriteAvatarsSorted, ctx);
                    }
                }
                if (type === 'friend') {
                    var ref = API.cachedUsers.get(objectId);
                    if (typeof ref !== 'undefined') {
                        if (ctx.ref !== ref) {
                            ctx.ref = ref;
                        }
                        if (ctx.name !== ref.displayName) {
                            ctx.name = ref.displayName;
                            this.sortFavoriteFriends = true;
                        }
                    }
                    // else too bad
                } else if (type === 'world') {
                    var ref = API.cachedWorlds.get(objectId);
                    if (typeof ref !== 'undefined') {
                        if (ctx.ref !== ref) {
                            ctx.ref = ref;
                        }
                        if (ctx.name !== ref.name) {
                            ctx.name = ref.name;
                            this.sortFavoriteWorlds = true;
                        }
                    } else {
                        // try fetch from local world favorites
                        var world = await database.getCachedWorldById(objectId);
                        if (world) {
                            ctx.ref = world;
                            ctx.name = world.name;
                            ctx.deleted = true;
                            this.sortFavoriteWorlds = true;
                        }
                        if (!world) {
                            // try fetch from local world history
                            var worldName =
                                await database.getGameLogWorldNameByWorldId(
                                    objectId
                                );
                            if (worldName) {
                                ctx.name = worldName;
                                ctx.deleted = true;
                                this.sortFavoriteWorlds = true;
                            }
                        }
                    }
                } else if (type === 'avatar') {
                    var ref = API.cachedAvatars.get(objectId);
                    if (typeof ref !== 'undefined') {
                        if (ctx.ref !== ref) {
                            ctx.ref = ref;
                        }
                        if (ctx.name !== ref.name) {
                            ctx.name = ref.name;
                            this.sortFavoriteAvatars = true;
                        }
                    } else {
                        // try fetch from local avatar history
                        var avatar =
                            await database.getCachedAvatarById(objectId);
                        if (avatar) {
                            ctx.ref = avatar;
                            ctx.name = avatar.name;
                            ctx.deleted = true;
                            this.sortFavoriteAvatars = true;
                        }
                    }
                }
            }
            if (isTypeChanged) {
                if (sortTop) {
                    if (type === 'friend') {
                        this.favoriteFriends_.unshift(ctx);
                        this.favoriteFriendsSorted.push(ctx);
                        this.sortFavoriteFriends = true;
                    } else if (type === 'world') {
                        this.favoriteWorlds_.unshift(ctx);
                        this.favoriteWorldsSorted.push(ctx);
                        this.sortFavoriteWorlds = true;
                    } else if (type === 'avatar') {
                        this.favoriteAvatars_.unshift(ctx);
                        this.favoriteAvatarsSorted.push(ctx);
                        this.sortFavoriteAvatars = true;
                    }
                } else if (type === 'friend') {
                    this.favoriteFriends_.push(ctx);
                    this.favoriteFriendsSorted.push(ctx);
                    this.sortFavoriteFriends = true;
                } else if (type === 'world') {
                    this.favoriteWorlds_.push(ctx);
                    this.favoriteWorldsSorted.push(ctx);
                    this.sortFavoriteWorlds = true;
                } else if (type === 'avatar') {
                    this.favoriteAvatars_.push(ctx);
                    this.favoriteAvatarsSorted.push(ctx);
                    this.sortFavoriteAvatars = true;
                }
            }
        } else if (typeof ctx !== 'undefined') {
            this.favoriteObjects.delete(objectId);
            if (type === 'friend') {
                removeFromArray(this.favoriteFriends_, ctx);
                removeFromArray(this.favoriteFriendsSorted, ctx);
            } else if (type === 'world') {
                removeFromArray(this.favoriteWorlds_, ctx);
                removeFromArray(this.favoriteWorldsSorted, ctx);
            } else if (type === 'avatar') {
                removeFromArray(this.favoriteAvatars_, ctx);
                removeFromArray(this.favoriteAvatarsSorted, ctx);
            }
        }
    };

    $app.methods.deleteFavorite = function (objectId) {
        // FIXME: 메시지 수정
        this.$confirm('Continue? Delete Favorite', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    API.deleteFavorite({
                        objectId
                    });
                }
            }
        });
    };

    $app.methods.deleteFavoriteNoConfirm = function (objectId) {
        if (!objectId) {
            return;
        }
        API.deleteFavorite({
            objectId
        });
    };

    $app.methods.changeFavoriteGroupName = function (ctx) {
        this.$prompt(
            $t('prompt.change_favorite_group_name.description'),
            $t('prompt.change_favorite_group_name.header'),
            {
                distinguishCancelAndClose: true,
                cancelButtonText: $t(
                    'prompt.change_favorite_group_name.cancel'
                ),
                confirmButtonText: $t(
                    'prompt.change_favorite_group_name.change'
                ),
                inputPlaceholder: $t(
                    'prompt.change_favorite_group_name.input_placeholder'
                ),
                inputValue: ctx.displayName,
                inputPattern: /\S+/,
                inputErrorMessage: $t(
                    'prompt.change_favorite_group_name.input_error'
                ),
                callback: (action, instance) => {
                    if (action === 'confirm') {
                        API.saveFavoriteGroup({
                            type: ctx.type,
                            group: ctx.name,
                            displayName: instance.inputValue
                        }).then((args) => {
                            this.$message({
                                message: $t(
                                    'prompt.change_favorite_group_name.message.success'
                                ),
                                type: 'success'
                            });
                            return args;
                        });
                    }
                }
            }
        );
    };

    $app.methods.clearFavoriteGroup = function (ctx) {
        // FIXME: 메시지 수정
        this.$confirm('Continue? Clear Group', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    API.clearFavoriteGroup({
                        type: ctx.type,
                        group: ctx.name
                    });
                }
            }
        });
    };

    $app.computed.favoriteFriends = function () {
        if (this.sortFavoriteFriends) {
            this.sortFavoriteFriends = false;
            this.favoriteFriendsSorted.sort(compareByName);
        }
        if (this.sortFavorites) {
            return this.favoriteFriends_;
        }
        return this.favoriteFriendsSorted;
    };

    $app.computed.favoriteWorlds = function () {
        if (this.sortFavoriteWorlds) {
            this.sortFavoriteWorlds = false;
            this.favoriteWorldsSorted.sort(compareByName);
        }
        if (this.sortFavorites) {
            return this.favoriteWorlds_;
        }
        return this.favoriteWorldsSorted;
    };

    $app.computed.favoriteAvatars = function () {
        if (this.sortFavoriteAvatars) {
            this.sortFavoriteAvatars = false;
            this.favoriteAvatarsSorted.sort(compareByName);
        }
        if (this.sortFavorites) {
            return this.favoriteAvatars_;
        }
        return this.favoriteAvatarsSorted;
    };

    // #endregion
    // #region | App: friendLog

    $app.data.friendLog = new Map();
    $app.data.friendLogTable = {
        data: [],
        filters: [
            {
                prop: 'type',
                value: [],
                filterFn: (row, filter) =>
                    filter.value.some((v) => v === row.type)
            },
            {
                prop: 'displayName',
                value: ''
            }
        ],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'created_at',
                order: 'descending'
            }
        },
        pageSize: $app.data.tablePageSize,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [10, 15, 25, 50, 100]
        }
    };

    API.$on('USER:CURRENT', function (args) {
        $app.updateFriendships(args.ref);
    });

    API.$on('USER', function (args) {
        $app.updateFriendship(args.ref);
        if (
            $app.friendLogInitStatus &&
            args.json.isFriend &&
            !$app.friendLog.has(args.ref.id) &&
            args.json.id !== this.currentUser.id
        ) {
            $app.addFriendship(args.ref.id);
        }
    });

    API.$on('FRIEND:ADD', function (args) {
        $app.addFriendship(args.params.userId);
    });

    API.$on('FRIEND:DELETE', function (args) {
        $app.deleteFriendship(args.params.userId);
    });

    API.$on('FRIEND:REQUEST', function (args) {
        var ref = this.cachedUsers.get(args.params.userId);
        if (typeof ref === 'undefined') {
            return;
        }
        var friendLogHistory = {
            created_at: new Date().toJSON(),
            type: 'FriendRequest',
            userId: ref.id,
            displayName: ref.displayName
        };
        $app.friendLogTable.data.push(friendLogHistory);
        database.addFriendLogHistory(friendLogHistory);
    });

    API.$on('FRIEND:REQUEST:CANCEL', function (args) {
        var ref = this.cachedUsers.get(args.params.userId);
        if (typeof ref === 'undefined') {
            return;
        }
        var friendLogHistory = {
            created_at: new Date().toJSON(),
            type: 'CancelFriendRequst',
            userId: ref.id,
            displayName: ref.displayName
        };
        $app.friendLogTable.data.push(friendLogHistory);
        database.addFriendLogHistory(friendLogHistory);
    });

    $app.data.friendLogInitStatus = false;

    $app.methods.initFriendLog = async function (userId) {
        await this.updateDatabaseVersion();
        var sqlValues = [];
        var friends = await API.refreshFriends();
        for (var friend of friends) {
            var ref = API.applyUser(friend);
            var row = {
                userId: ref.id,
                displayName: ref.displayName,
                trustLevel: ref.$trustLevel
            };
            this.friendLog.set(friend.id, row);
            sqlValues.unshift(row);
        }
        database.setFriendLogCurrentArray(sqlValues);
        await configRepository.setBool(`friendLogInit_${userId}`, true);
        this.friendLogInitStatus = true;
    };

    $app.methods.migrateFriendLog = async function (userId) {
        VRCXStorage.Remove(`${userId}_friendLogUpdatedAt`);
        VRCXStorage.Remove(`${userId}_friendLog`);
        this.friendLogTable.data = await VRCXStorage.GetArray(
            `${userId}_friendLogTable`
        );
        database.addFriendLogHistoryArray(this.friendLogTable.data);
        VRCXStorage.Remove(`${userId}_friendLogTable`);
        await configRepository.setBool(`friendLogInit_${userId}`, true);
    };

    $app.methods.getFriendLog = async function () {
        await this.updateDatabaseVersion();
        var friendLogCurrentArray = await database.getFriendLogCurrent();
        for (var friend of friendLogCurrentArray) {
            this.friendLog.set(friend.userId, friend);
        }
        this.friendLogTable.data = [];
        this.friendLogTable.data = await database.getFriendLogHistory();
        await API.refreshFriends();
        this.friendLogInitStatus = true;
        // check for friend/name/rank change AFTER friendLogInitStatus is set
        for (var friend of friendLogCurrentArray) {
            var ref = API.cachedUsers.get(friend.userId);
            if (typeof ref !== 'undefined') {
                this.updateFriendship(ref);
            }
        }
        if (typeof API.currentUser.friends !== 'undefined') {
            this.updateFriendships(API.currentUser);
        }
    };

    $app.methods.addFriendship = function (id) {
        if (!this.friendLogInitStatus || this.friendLog.has(id)) {
            return;
        }
        var ref = API.cachedUsers.get(id);
        if (typeof ref === 'undefined') {
            try {
                API.getUser({
                    userId: id
                });
            } catch {}
            return;
        }
        API.getFriendStatus({
            userId: id
        }).then((args) => {
            if (args.json.isFriend && !this.friendLog.has(id)) {
                this.addFriend(id, ref.state);
                var friendLogHistory = {
                    created_at: new Date().toJSON(),
                    type: 'Friend',
                    userId: id,
                    displayName: ref.displayName
                };
                this.friendLogTable.data.push(friendLogHistory);
                database.addFriendLogHistory(friendLogHistory);
                this.queueFriendLogNoty(friendLogHistory);
                var friendLogCurrent = {
                    userId: id,
                    displayName: ref.displayName,
                    trustLevel: ref.$trustLevel
                };
                this.friendLog.set(id, friendLogCurrent);
                database.setFriendLogCurrent(friendLogCurrent);
                this.notifyMenu('friendLog');
                this.deleteFriendRequest(id);
                this.updateSharedFeed(true);
                API.getUser({
                    userId: id
                }).then(() => {
                    if (this.userDialog.visible && id === this.userDialog.id) {
                        this.applyUserDialogLocation(true);
                    }
                });
            }
        });
    };

    $app.methods.deleteFriendRequest = function (userId) {
        var array = $app.notificationTable.data;
        for (var i = array.length - 1; i >= 0; i--) {
            if (
                array[i].type === 'friendRequest' &&
                array[i].senderUserId === userId
            ) {
                array.splice(i, 1);
                return;
            }
        }
    };

    $app.methods.deleteFriendship = function (id) {
        var ctx = this.friendLog.get(id);
        if (typeof ctx === 'undefined') {
            return;
        }
        API.getFriendStatus({
            userId: id
        }).then((args) => {
            if (!args.json.isFriend && this.friendLog.has(id)) {
                var friendLogHistory = {
                    created_at: new Date().toJSON(),
                    type: 'Unfriend',
                    userId: id,
                    displayName: ctx.displayName
                };
                this.friendLogTable.data.push(friendLogHistory);
                database.addFriendLogHistory(friendLogHistory);
                this.queueFriendLogNoty(friendLogHistory);
                this.friendLog.delete(id);
                database.deleteFriendLogCurrent(id);
                this.notifyMenu('friendLog');
                this.updateSharedFeed(true);
                this.deleteFriend(id);
            }
        });
    };

    $app.methods.updateFriendships = function (ref) {
        var set = new Set();
        for (var id of ref.friends) {
            set.add(id);
            this.addFriendship(id);
        }
        for (var id of this.friendLog.keys()) {
            if (id === API.currentUser.id) {
                this.friendLog.delete(id);
                database.deleteFriendLogCurrent(id);
            } else if (!set.has(id)) {
                this.deleteFriendship(id);
            }
        }
    };

    $app.methods.updateFriendship = function (ref) {
        var ctx = this.friendLog.get(ref.id);
        if (!this.friendLogInitStatus || typeof ctx === 'undefined') {
            return;
        }
        if (ctx.displayName !== ref.displayName) {
            if (ctx.displayName) {
                var friendLogHistoryDisplayName = {
                    created_at: new Date().toJSON(),
                    type: 'DisplayName',
                    userId: ref.id,
                    displayName: ref.displayName,
                    previousDisplayName: ctx.displayName
                };
                this.friendLogTable.data.push(friendLogHistoryDisplayName);
                database.addFriendLogHistory(friendLogHistoryDisplayName);
                this.queueFriendLogNoty(friendLogHistoryDisplayName);
                var friendLogCurrent = {
                    userId: ref.id,
                    displayName: ref.displayName,
                    trustLevel: ref.$trustLevel
                };
                this.friendLog.set(ref.id, friendLogCurrent);
                database.setFriendLogCurrent(friendLogCurrent);
                ctx.displayName = ref.displayName;
                this.notifyMenu('friendLog');
                this.updateSharedFeed(true);
            }
        }
        if (
            ref.$trustLevel &&
            ctx.trustLevel &&
            ctx.trustLevel !== ref.$trustLevel
        ) {
            if (
                (ctx.trustLevel === 'Trusted User' &&
                    ref.$trustLevel === 'Veteran User') ||
                (ctx.trustLevel === 'Veteran User' &&
                    ref.$trustLevel === 'Trusted User')
            ) {
                var friendLogCurrent3 = {
                    userId: ref.id,
                    displayName: ref.displayName,
                    trustLevel: ref.$trustLevel
                };
                this.friendLog.set(ref.id, friendLogCurrent3);
                database.setFriendLogCurrent(friendLogCurrent3);
                return;
            }
            var friendLogHistoryTrustLevel = {
                created_at: new Date().toJSON(),
                type: 'TrustLevel',
                userId: ref.id,
                displayName: ref.displayName,
                trustLevel: ref.$trustLevel,
                previousTrustLevel: ctx.trustLevel
            };
            this.friendLogTable.data.push(friendLogHistoryTrustLevel);
            database.addFriendLogHistory(friendLogHistoryTrustLevel);
            this.queueFriendLogNoty(friendLogHistoryTrustLevel);
            var friendLogCurrent2 = {
                userId: ref.id,
                displayName: ref.displayName,
                trustLevel: ref.$trustLevel
            };
            this.friendLog.set(ref.id, friendLogCurrent2);
            database.setFriendLogCurrent(friendLogCurrent2);
            this.notifyMenu('friendLog');
            this.updateSharedFeed(true);
        }
        ctx.trustLevel = ref.$trustLevel;
    };

    $app.methods.deleteFriendLog = function (row) {
        this.$confirm('Continue? Delete Log', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    removeFromArray(this.friendLogTable.data, row);
                    database.deleteFriendLogHistory(row.rowId);
                }
            }
        });
    };

    // #endregion
    // #region | App: Moderation

    $app.data.playerModerationTable = {
        data: [],
        lastRunLength: 0,
        filters: [
            {
                prop: 'type',
                value: [],
                filterFn: (row, filter) =>
                    filter.value.some((v) => v === row.type)
            },
            {
                prop: ['sourceDisplayName', 'targetDisplayName'],
                value: ''
            }
        ],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'created',
                order: 'descending'
            }
        },
        pageSize: $app.data.tablePageSize,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [10, 15, 25, 50, 100]
        }
    };

    API.$on('LOGIN', function () {
        $app.playerModerationTable.data = [];
    });

    API.$on('PLAYER-MODERATION', function (args) {
        var { ref } = args;
        var array = $app.playerModerationTable.data;
        var { length } = array;
        for (var i = 0; i < length; ++i) {
            if (array[i].id === ref.id) {
                if (ref.$isDeleted) {
                    array.splice(i, 1);
                } else {
                    Vue.set(array, i, ref);
                }
                return;
            }
        }
        if (ref.$isDeleted === false) {
            $app.playerModerationTable.data.push(ref);
        }
    });

    API.$on('PLAYER-MODERATION:@DELETE', function (args) {
        var { ref } = args;
        var array = $app.playerModerationTable.data;
        var { length } = array;
        for (var i = 0; i < length; ++i) {
            if (array[i].id === ref.id) {
                array.splice(i, 1);
                return;
            }
        }
    });

    $app.methods.deletePlayerModeration = function (row) {
        // FIXME: 메시지 수정
        this.$confirm('Continue? Delete Moderation', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    API.deletePlayerModeration({
                        moderated: row.targetUserId,
                        type: row.type
                    });
                }
            }
        });
    };

    // #endregion
    // #region | App: Notification

    $app.data.notificationTable = {
        data: [],
        filters: [
            {
                prop: 'type',
                value: [],
                filterFn: (row, filter) =>
                    filter.value.some((v) => v === row.type)
            },
            {
                prop: ['senderUsername', 'message'],
                value: ''
            }
        ],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'created_at',
                order: 'descending'
            }
        },
        pageSize: $app.data.tablePageSize,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [10, 15, 25, 50, 100]
        }
    };

    API.$on('LOGIN', function () {
        $app.notificationTable.data = [];
    });

    $app.data.unseenNotifications = [];

    API.$on('NOTIFICATION', function (args) {
        var { ref } = args;
        var array = $app.notificationTable.data;
        var { length } = array;
        for (var i = 0; i < length; ++i) {
            if (array[i].id === ref.id) {
                Vue.set(array, i, ref);
                return;
            }
        }
        if (ref.senderUserId !== this.currentUser.id) {
            if (
                ref.type !== 'friendRequest' &&
                ref.type !== 'hiddenFriendRequest' &&
                !ref.type.includes('.')
            ) {
                database.addNotificationToDatabase(ref);
            }
            if ($app.friendLogInitStatus) {
                $app.notifyMenu('notification');
                $app.unseenNotifications.push(ref.id);
                $app.queueNotificationNoty(ref);
            }
        }
        $app.notificationTable.data.push(ref);
        $app.updateSharedFeed(true);
    });

    API.$on('NOTIFICATION:SEE', function (args) {
        var { notificationId } = args.params;
        removeFromArray($app.unseenNotifications, notificationId);
        if ($app.unseenNotifications.length === 0) {
            $app.selectMenu('notification');
        }
    });

    $app.methods.acceptNotification = function (row) {
        // FIXME: 메시지 수정
        this.$confirm('Continue? Accept Friend Request', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    API.acceptNotification({
                        notificationId: row.id
                    });
                }
            }
        });
    };

    $app.methods.hideNotification = function (row) {
        this.$confirm(`Continue? Decline ${row.type}`, 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    if (row.type === 'hiddenFriendRequest') {
                        API.deleteHiddenFriendRequest(
                            {
                                notificationId: row.id
                            },
                            row.senderUserId
                        );
                    } else {
                        API.hideNotification({
                            notificationId: row.id
                        });
                    }
                }
            }
        });
    };

    $app.methods.deleteNotificationLog = function (row) {
        this.$confirm(`Continue? Delete ${row.type}`, 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    removeFromArray(this.notificationTable.data, row);
                    if (
                        row.type !== 'friendRequest' &&
                        row.type !== 'hiddenFriendRequest'
                    ) {
                        database.deleteNotification(row.id);
                    }
                }
            }
        });
    };

    $app.methods.acceptRequestInvite = function (row) {
        this.$confirm('Continue? Send Invite', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    var currentLocation = this.lastLocation.location;
                    if (this.lastLocation.location === 'traveling') {
                        currentLocation = this.lastLocationDestination;
                    }
                    var L = API.parseLocation(currentLocation);
                    API.getCachedWorld({
                        worldId: L.worldId
                    }).then((args) => {
                        API.sendInvite(
                            {
                                instanceId: L.tag,
                                worldId: L.tag,
                                worldName: args.ref.name,
                                rsvp: true
                            },
                            row.senderUserId
                        ).then((_args) => {
                            this.$message('Invite sent');
                            API.hideNotification({
                                notificationId: row.id
                            });
                            return _args;
                        });
                    });
                }
            }
        });
    };

    // Save Table Filters
    $app.methods.saveTableFilters = async function () {
        await configRepository.setString(
            'VRCX_friendLogTableFilters',
            JSON.stringify(this.friendLogTable.filters[0].value)
        );
        await configRepository.setString(
            'VRCX_playerModerationTableFilters',
            JSON.stringify(this.playerModerationTable.filters[0].value)
        );
        await configRepository.setString(
            'VRCX_notificationTableFilters',
            JSON.stringify(this.notificationTable.filters[0].value)
        );
    };

    $app.data.feedTable.filter = JSON.parse(
        await configRepository.getString('VRCX_feedTableFilters', '[]')
    );
    $app.data.feedTable.vip = await configRepository.getBool(
        'VRCX_feedTableVIPFilter',
        false
    );
    $app.data.gameLogTable.filter = JSON.parse(
        await configRepository.getString('VRCX_gameLogTableFilters', '[]')
    );
    $app.data.friendLogTable.filters[0].value = JSON.parse(
        await configRepository.getString('VRCX_friendLogTableFilters', '[]')
    );
    $app.data.playerModerationTable.filters[0].value = JSON.parse(
        await configRepository.getString(
            'VRCX_playerModerationTableFilters',
            '[]'
        )
    );
    $app.data.notificationTable.filters[0].value = JSON.parse(
        await configRepository.getString('VRCX_notificationTableFilters', '[]')
    );
    $app.data.photonEventTableTypeFilter = JSON.parse(
        await configRepository.getString('VRCX_photonEventTypeFilter', '[]')
    );
    $app.data.photonEventTable.filters[1].value =
        $app.data.photonEventTableTypeFilter;
    $app.data.photonEventTablePrevious.filters[1].value =
        $app.data.photonEventTableTypeFilter;
    $app.data.photonEventTableTypeOverlayFilter = JSON.parse(
        await configRepository.getString(
            'VRCX_photonEventTypeOverlayFilter',
            '[]'
        )
    );

    // #endregion
    // #region | App: Profile + Settings

    $app.data.configTreeData = [];
    $app.data.currentUserTreeData = [];
    $app.data.currentUserFeedbackData = [];
    $app.data.pastDisplayNameTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'updated_at',
                order: 'descending'
            }
        },
        layout: 'table'
    };
    $app.data.emojiTable = [];
    $app.data.VRCPlusIconsTable = [];
    $app.data.galleryTable = [];
    $app.data.inviteMessageTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table',
        visible: false
    };
    $app.data.inviteResponseMessageTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table',
        visible: false
    };
    $app.data.inviteRequestMessageTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table',
        visible: false
    };
    $app.data.inviteRequestResponseMessageTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table',
        visible: false
    };
    $app.data.friendsListTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: '$friendNum',
                order: 'descending'
            }
        },
        pageSize: 100,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [50, 100, 250, 500]
        }
    };
    $app.data.downloadHistoryTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        pageSize: 10,
        paginationProps: {
            small: true,
            layout: 'prev,pager,next',
            pageSizes: [10, 25, 50, 100]
        }
    };
    $app.data.downloadQueueTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table'
    };
    $app.data.socialStatusHistoryTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table'
    };
    $app.data.currentInstanceUserList = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'timer',
                order: 'descending'
            }
        },
        layout: 'table'
    };
    $app.data.visits = 0;
    $app.data.openVR = await configRepository.getBool('openVR', false);
    $app.data.openVRAlways = await configRepository.getBool(
        'openVRAlways',
        false
    );
    $app.data.overlaybutton = await configRepository.getBool(
        'VRCX_overlaybutton',
        false
    );
    $app.data.overlayHand = await configRepository.getInt(
        'VRCX_overlayHand',
        0
    );
    $app.data.hidePrivateFromFeed = await configRepository.getBool(
        'VRCX_hidePrivateFromFeed',
        false
    );
    $app.data.hideDevicesFromFeed = await configRepository.getBool(
        'VRCX_hideDevicesFromFeed',
        false
    );
    $app.data.hideCpuUsageFromFeed = await configRepository.getBool(
        'VRCX_hideCpuUsageFromFeed',
        false
    );
    $app.data.hideUptimeFromFeed = await configRepository.getBool(
        'VRCX_hideUptimeFromFeed',
        false
    );
    $app.data.pcUptimeOnFeed = await configRepository.getBool(
        'VRCX_pcUptimeOnFeed',
        false
    );
    $app.data.overlayNotifications = await configRepository.getBool(
        'VRCX_overlayNotifications',
        true
    );
    $app.data.overlayWrist = await configRepository.getBool(
        'VRCX_overlayWrist',
        false
    );
    $app.data.xsNotifications = await configRepository.getBool(
        'VRCX_xsNotifications',
        true
    );
    $app.data.imageNotifications = await configRepository.getBool(
        'VRCX_imageNotifications',
        true
    );
    $app.data.desktopToast = await configRepository.getString(
        'VRCX_desktopToast',
        'Never'
    );
    $app.data.afkDesktopToast = await configRepository.getBool(
        'VRCX_afkDesktopToast',
        false
    );
    $app.data.minimalFeed = await configRepository.getBool(
        'VRCX_minimalFeed',
        false
    );
    $app.data.displayVRCPlusIconsAsAvatar = await configRepository.getBool(
        'displayVRCPlusIconsAsAvatar',
        true
    );
    $app.data.hideTooltips = await configRepository.getBool(
        'VRCX_hideTooltips',
        false
    );
    $app.data.notificationTTS = await configRepository.getString(
        'VRCX_notificationTTS',
        'Never'
    );
    $app.data.notificationTTSVoice = await configRepository.getString(
        'VRCX_notificationTTSVoice',
        '0'
    );
    $app.data.notificationTimeout = await configRepository.getString(
        'VRCX_notificationTimeout',
        '3000'
    );
    $app.data.autoSweepVRChatCache = await configRepository.getBool(
        'VRCX_autoSweepVRChatCache',
        false
    );
    $app.data.relaunchVRChatAfterCrash = await configRepository.getBool(
        'VRCX_relaunchVRChatAfterCrash',
        false
    );
    $app.data.vrcQuitFix = await configRepository.getBool(
        'VRCX_vrcQuitFix',
        true
    );
    $app.data.vrBackgroundEnabled = await configRepository.getBool(
        'VRCX_vrBackgroundEnabled',
        false
    );
    $app.data.asideWidth = await configRepository.getInt(
        'VRCX_sidePanelWidth',
        300
    );
    if (await configRepository.getInt('VRCX_asidewidth')) {
        // migrate to new defaults
        $app.data.asideWidth = await configRepository.getInt('VRCX_asidewidth');
        if ($app.data.asideWidth < 300) {
            $app.data.asideWidth = 300;
        }
        await configRepository.setInt(
            'VRCX_sidePanelWidth',
            $app.data.asideWidth
        );
        await configRepository.remove('VRCX_asidewidth');
    }
    $app.data.autoUpdateVRCX = await configRepository.getString(
        'VRCX_autoUpdateVRCX',
        'Auto Download'
    );
    $app.data.branch = await configRepository.getString(
        'VRCX_branch',
        'Stable'
    );
    $app.data.maxTableSize = await configRepository.getInt(
        'VRCX_maxTableSize',
        1000
    );
    if ($app.data.maxTableSize > 10000) {
        $app.data.maxTableSize = 1000;
    }
    database.setmaxTableSize($app.data.maxTableSize);
    $app.data.photonLobbyTimeoutThreshold = await configRepository.getString(
        'VRCX_photonLobbyTimeoutThreshold',
        6000
    );
    $app.data.clearVRCXCacheFrequency = await configRepository.getString(
        'VRCX_clearVRCXCacheFrequency',
        '172800'
    );
    $app.data.avatarRemoteDatabase = await configRepository.getBool(
        'VRCX_avatarRemoteDatabase',
        true
    );
    $app.data.avatarRemoteDatabaseProvider = '';
    $app.data.avatarRemoteDatabaseProviderList = JSON.parse(
        await configRepository.getString(
            'VRCX_avatarRemoteDatabaseProviderList',
            '[ "https://avtr.just-h.party/vrcx_search.php" ]'
        )
    );
    $app.data.pendingOfflineDelay = await configRepository.getInt(
        'VRCX_pendingOfflineDelay',
        110000
    );
    if (await configRepository.getString('VRCX_avatarRemoteDatabaseProvider')) {
        // move existing provider to new list
        var avatarRemoteDatabaseProvider = await configRepository.getString(
            'VRCX_avatarRemoteDatabaseProvider'
        );
        if (
            !$app.data.avatarRemoteDatabaseProviderList.includes(
                avatarRemoteDatabaseProvider
            )
        ) {
            $app.data.avatarRemoteDatabaseProviderList.push(
                avatarRemoteDatabaseProvider
            );
        }
        await configRepository.remove('VRCX_avatarRemoteDatabaseProvider');
        await configRepository.setString(
            'VRCX_avatarRemoteDatabaseProviderList',
            JSON.stringify($app.data.avatarRemoteDatabaseProviderList)
        );
    }
    if ($app.data.avatarRemoteDatabaseProviderList.length > 0) {
        $app.data.avatarRemoteDatabaseProvider =
            $app.data.avatarRemoteDatabaseProviderList[0];
    }
    $app.data.sortFavorites = await configRepository.getBool(
        'VRCX_sortFavorites',
        true
    );
    $app.data.randomUserColours = await configRepository.getBool(
        'VRCX_randomUserColours',
        false
    );
    $app.data.hideUserNotes = await configRepository.getBool(
        'VRCX_hideUserNotes',
        false
    );
    $app.data.hideUserMemos = await configRepository.getBool(
        'VRCX_hideUserMemos',
        false
    );
    $app.methods.saveOpenVROption = async function () {
        await configRepository.setBool('openVR', this.openVR);
        await configRepository.setBool('openVRAlways', this.openVRAlways);
        await configRepository.setBool(
            'VRCX_overlaybutton',
            this.overlaybutton
        );
        this.overlayHand = parseInt(this.overlayHand, 10);
        if (isNaN(this.overlayHand)) {
            this.overlayHand = 0;
        }
        await configRepository.setInt('VRCX_overlayHand', this.overlayHand);
        await configRepository.setBool(
            'VRCX_hidePrivateFromFeed',
            this.hidePrivateFromFeed
        );
        await configRepository.setBool(
            'VRCX_hideDevicesFromFeed',
            this.hideDevicesFromFeed
        );
        await configRepository.setBool(
            'VRCX_hideCpuUsageFromFeed',
            this.hideCpuUsageFromFeed
        );
        await configRepository.setBool(
            'VRCX_hideUptimeFromFeed',
            this.hideUptimeFromFeed
        );
        await configRepository.setBool(
            'VRCX_pcUptimeOnFeed',
            this.pcUptimeOnFeed
        );
        await configRepository.setBool(
            'VRCX_overlayNotifications',
            this.overlayNotifications
        );
        await configRepository.setBool('VRCX_overlayWrist', this.overlayWrist);
        await configRepository.setBool(
            'VRCX_xsNotifications',
            this.xsNotifications
        );
        await configRepository.setBool(
            'VRCX_imageNotifications',
            this.imageNotifications
        );
        await configRepository.setString(
            'VRCX_desktopToast',
            this.desktopToast
        );
        await configRepository.setBool(
            'VRCX_afkDesktopToast',
            this.afkDesktopToast
        );
        await configRepository.setBool('VRCX_minimalFeed', this.minimalFeed);
        await configRepository.setBool(
            'displayVRCPlusIconsAsAvatar',
            this.displayVRCPlusIconsAsAvatar
        );
        await configRepository.setBool('VRCX_hideTooltips', this.hideTooltips);
        await configRepository.setBool(
            'VRCX_autoSweepVRChatCache',
            this.autoSweepVRChatCache
        );
        await configRepository.setBool(
            'VRCX_relaunchVRChatAfterCrash',
            this.relaunchVRChatAfterCrash
        );
        await configRepository.setBool('VRCX_vrcQuitFix', this.vrcQuitFix);
        await configRepository.setBool(
            'VRCX_vrBackgroundEnabled',
            this.vrBackgroundEnabled
        );
        await configRepository.setBool(
            'VRCX_avatarRemoteDatabase',
            this.avatarRemoteDatabase
        );
        await configRepository.setBool(
            'VRCX_instanceUsersSortAlphabetical',
            this.instanceUsersSortAlphabetical
        );
        await configRepository.setBool(
            'VRCX_randomUserColours',
            this.randomUserColours
        );
        await configRepository.setBool(
            'VRCX_udonExceptionLogging',
            this.udonExceptionLogging
        );
        this.updateSharedFeed(true);
        this.updateVRConfigVars();
        this.updateVRLastLocation();
        AppApi.ExecuteVrOverlayFunction('notyClear', '');
        this.updateOpenVR();
    };
    $app.methods.saveSortFavoritesOption = async function () {
        this.getLocalWorldFavorites();
        await configRepository.setBool(
            'VRCX_sortFavorites',
            this.sortFavorites
        );
    };
    $app.methods.saveUserDialogOption = async function () {
        await configRepository.setBool(
            'VRCX_hideUserNotes',
            this.hideUserNotes
        );
        await configRepository.setBool(
            'VRCX_hideUserMemos',
            this.hideUserMemos
        );
    };
    $app.data.TTSvoices = speechSynthesis.getVoices();
    $app.methods.saveNotificationTTS = async function () {
        speechSynthesis.cancel();
        if (
            (await configRepository.getString('VRCX_notificationTTS')) ===
                'Never' &&
            this.notificationTTS !== 'Never'
        ) {
            this.speak('Notification text-to-speech enabled');
        }
        await configRepository.setString(
            'VRCX_notificationTTS',
            this.notificationTTS
        );
        this.updateVRConfigVars();
    };
    $app.data.themeMode = await configRepository.getString(
        'VRCX_ThemeMode',
        'system'
    );

    $app.data.isDarkMode = false;

    $app.methods.systemIsDarkMode = function () {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    };

    window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', async () => {
            if ($app.themeMode === 'system') {
                await $app.saveThemeMode();
            }
        });

    $app.methods.saveThemeMode = async function () {
        await configRepository.setString('VRCX_ThemeMode', this.themeMode);
        await this.changeThemeMode();
    };

    $app.methods.changeThemeMode = async function () {
        if (document.contains(document.getElementById('app-theme-style'))) {
            document.getElementById('app-theme-style').remove();
        }
        var $appThemeStyle = document.createElement('link');
        $appThemeStyle.setAttribute('id', 'app-theme-style');
        $appThemeStyle.rel = 'stylesheet';
        switch (this.themeMode) {
            case 'light':
                $appThemeStyle.href = '';
                this.isDarkMode = false;
                break;
            case 'dark':
                $appThemeStyle.href = 'theme.dark.css';
                this.isDarkMode = true;
                break;
            case 'darkvanilla':
                $appThemeStyle.href = 'theme.darkvanilla.css';
                this.isDarkMode = true;
                break;
            case 'pink':
                $appThemeStyle.href = 'theme.pink.css';
                this.isDarkMode = true;
                break;
            case 'material3':
                $appThemeStyle.href = 'theme.material3.css';
                this.isDarkMode = true;
                break;
            case 'system':
                if (this.systemIsDarkMode()) {
                    $appThemeStyle.href = 'theme.dark.css';
                    this.isDarkMode = true;
                } else {
                    $appThemeStyle.href = '';
                    this.isDarkMode = false;
                }
                break;
        }
        if (this.isDarkMode) {
            AppApi.ChangeTheme(1);
        } else {
            AppApi.ChangeTheme(0);
        }
        document.head.appendChild($appThemeStyle);
        this.updateVRConfigVars();
        await this.updatetrustColor();
    };

    $app.data.isStartAtWindowsStartup = await configRepository.getBool(
        'VRCX_StartAtWindowsStartup',
        false
    );
    $app.data.isStartAsMinimizedState = false;
    $app.data.isCloseToTray = false;
    VRCXStorage.Get('VRCX_StartAsMinimizedState').then((result) => {
        $app.isStartAsMinimizedState = result === 'true';
    });
    VRCXStorage.Get('VRCX_CloseToTray').then((result) => {
        $app.isCloseToTray = result === 'true';
    });
    if (await configRepository.getBool('VRCX_CloseToTray')) {
        // move back to JSON
        $app.data.isCloseToTray =
            await configRepository.getBool('VRCX_CloseToTray');
        VRCXStorage.Set('VRCX_CloseToTray', $app.data.isCloseToTray.toString());
        await configRepository.remove('VRCX_CloseToTray');
    }
    $app.methods.saveVRCXWindowOption = async function () {
        await configRepository.setBool(
            'VRCX_StartAtWindowsStartup',
            this.isStartAtWindowsStartup
        );
        VRCXStorage.Set(
            'VRCX_StartAsMinimizedState',
            this.isStartAsMinimizedState.toString()
        );
        VRCXStorage.Set('VRCX_CloseToTray', this.isCloseToTray.toString());
        AppApi.SetStartup(this.isStartAtWindowsStartup);
    };
    $app.data.photonEventOverlay = await configRepository.getBool(
        'VRCX_PhotonEventOverlay',
        false
    );
    $app.data.timeoutHudOverlay = await configRepository.getBool(
        'VRCX_TimeoutHudOverlay',
        false
    );
    $app.data.timeoutHudOverlayFilter = await configRepository.getString(
        'VRCX_TimeoutHudOverlayFilter',
        'Everyone'
    );
    $app.data.photonEventOverlayFilter = await configRepository.getString(
        'VRCX_PhotonEventOverlayFilter',
        'Everyone'
    );
    $app.data.photonOverlayMessageTimeout = Number(
        await configRepository.getString(
            'VRCX_photonOverlayMessageTimeout',
            6000
        )
    );
    $app.data.photonLoggingEnabled = false;
    $app.data.gameLogDisabled = await configRepository.getBool(
        'VRCX_gameLogDisabled',
        false
    );
    $app.data.udonExceptionLogging = await configRepository.getBool(
        'VRCX_udonExceptionLogging',
        false
    );
    $app.data.instanceUsersSortAlphabetical = await configRepository.getBool(
        'VRCX_instanceUsersSortAlphabetical',
        false
    );
    $app.methods.saveEventOverlay = async function () {
        await configRepository.setBool(
            'VRCX_PhotonEventOverlay',
            this.photonEventOverlay
        );
        await configRepository.setBool(
            'VRCX_TimeoutHudOverlay',
            this.timeoutHudOverlay
        );
        await configRepository.setString(
            'VRCX_TimeoutHudOverlayFilter',
            this.timeoutHudOverlayFilter
        );
        await configRepository.setString(
            'VRCX_PhotonEventOverlayFilter',
            this.photonEventOverlayFilter
        );
        if (!this.timeoutHudOverlay) {
            AppApi.ExecuteVrOverlayFunction('updateHudTimeout', '[]');
        }
        this.updateOpenVR();
        this.updateVRConfigVars();
    };
    $app.data.logResourceLoad = await configRepository.getBool(
        'VRCX_logResourceLoad',
        false
    );
    $app.methods.saveGameLogOptions = async function () {
        await configRepository.setBool(
            'VRCX_logResourceLoad',
            this.logResourceLoad
        );
    };
    $app.data.autoStateChange = await configRepository.getString(
        'VRCX_autoStateChange',
        'Off'
    );
    $app.methods.saveAutomationOptions = async function () {
        await configRepository.setString(
            'VRCX_autoStateChange',
            this.autoStateChange
        );
    };
    $app.data.vrcRegistryAutoBackup = await configRepository.getBool(
        'VRCX_vrcRegistryAutoBackup',
        true
    );
    $app.methods.saveVrcRegistryAutoBackup = async function () {
        await configRepository.setBool(
            'VRCX_vrcRegistryAutoBackup',
            this.vrcRegistryAutoBackup
        );
    };
    $app.data.orderFriendsGroup0 = await configRepository.getBool(
        'orderFriendGroup0',
        true
    );
    $app.data.orderFriendsGroup1 = await configRepository.getBool(
        'orderFriendGroup1',
        true
    );
    $app.data.orderFriendsGroup2 = await configRepository.getBool(
        'orderFriendGroup2',
        true
    );
    $app.data.orderFriendsGroup3 = await configRepository.getBool(
        'orderFriendGroup3',
        true
    );
    $app.data.orderFriendsGroupPrivate = await configRepository.getBool(
        'orderFriendGroupPrivate',
        false
    );
    $app.data.orderFriendsGroupStatus = await configRepository.getBool(
        'orderFriendsGroupStatus',
        false
    );
    $app.data.orderFriendsGroupGPS = await configRepository.getBool(
        'orderFriendGroupGPS',
        true
    );
    $app.methods.saveOrderFriendGroup = async function () {
        await configRepository.setBool(
            'orderFriendGroup0',
            this.orderFriendsGroup0
        );
        await configRepository.setBool(
            'orderFriendGroup1',
            this.orderFriendsGroup1
        );
        await configRepository.setBool(
            'orderFriendGroup2',
            this.orderFriendsGroup2
        );
        await configRepository.setBool(
            'orderFriendGroup3',
            this.orderFriendsGroup3
        );
        await configRepository.setBool(
            'orderFriendGroupPrivate',
            this.orderFriendsGroupPrivate
        );
        await configRepository.setBool(
            'orderFriendsGroupStatus',
            this.orderFriendsGroupStatus
        );
        await configRepository.setBool(
            'orderFriendGroupGPS',
            this.orderFriendsGroupGPS
        );
        this.sortFriendsGroup0 = true;
        this.sortFriendsGroup1 = true;
    };
    $app.data.discordActive = await configRepository.getBool(
        'discordActive',
        false
    );
    $app.data.discordInstance = await configRepository.getBool(
        'discordInstance',
        true
    );
    $app.data.discordJoinButton = await configRepository.getBool(
        'discordJoinButton',
        false
    );
    $app.data.discordHideInvite = await configRepository.getBool(
        'discordHideInvite',
        true
    );
    $app.data.discordHideImage = await configRepository.getBool(
        'discordHideImage',
        false
    );
    $app.methods.saveDiscordOption = async function () {
        await configRepository.setBool('discordActive', this.discordActive);
        await configRepository.setBool('discordInstance', this.discordInstance);
        await configRepository.setBool(
            'discordJoinButton',
            this.discordJoinButton
        );
        await configRepository.setBool(
            'discordHideInvite',
            this.discordHideInvite
        );
        await configRepository.setBool(
            'discordHideImage',
            this.discordHideImage
        );
        this.lastLocation$.tag = '';
        this.nextDiscordUpdate = 7;
        this.updateDiscord();
    };

    // setting defaults
    var sharedFeedFilters = {
        noty: {
            Location: 'Off',
            OnPlayerJoined: 'VIP',
            OnPlayerLeft: 'VIP',
            OnPlayerJoining: 'VIP',
            Online: 'VIP',
            Offline: 'VIP',
            GPS: 'Off',
            Status: 'Off',
            invite: 'Friends',
            requestInvite: 'Friends',
            inviteResponse: 'Friends',
            requestInviteResponse: 'Friends',
            friendRequest: 'On',
            Friend: 'On',
            Unfriend: 'On',
            DisplayName: 'VIP',
            TrustLevel: 'VIP',
            'group.announcement': 'On',
            'group.informative': 'On',
            'group.invite': 'On',
            'group.joinRequest': 'Off',
            'group.queueReady': 'On',
            PortalSpawn: 'Everyone',
            Event: 'On',
            External: 'On',
            VideoPlay: 'Off',
            BlockedOnPlayerJoined: 'Off',
            BlockedOnPlayerLeft: 'Off',
            MutedOnPlayerJoined: 'Off',
            MutedOnPlayerLeft: 'Off',
            AvatarChange: 'Off',
            ChatBoxMessage: 'Off',
            Blocked: 'Off',
            Unblocked: 'Off',
            Muted: 'Off',
            Unmuted: 'Off'
        },
        wrist: {
            Location: 'On',
            OnPlayerJoined: 'Everyone',
            OnPlayerLeft: 'Everyone',
            OnPlayerJoining: 'Friends',
            Online: 'Friends',
            Offline: 'Friends',
            GPS: 'Friends',
            Status: 'Friends',
            invite: 'Friends',
            requestInvite: 'Friends',
            inviteResponse: 'Friends',
            requestInviteResponse: 'Friends',
            friendRequest: 'On',
            Friend: 'On',
            Unfriend: 'On',
            DisplayName: 'Friends',
            TrustLevel: 'Friends',
            'group.announcement': 'On',
            'group.informative': 'On',
            'group.invite': 'On',
            'group.joinRequest': 'On',
            'group.queueReady': 'On',
            PortalSpawn: 'Everyone',
            Event: 'On',
            External: 'On',
            VideoPlay: 'On',
            BlockedOnPlayerJoined: 'Off',
            BlockedOnPlayerLeft: 'Off',
            MutedOnPlayerJoined: 'Off',
            MutedOnPlayerLeft: 'Off',
            AvatarChange: 'Everyone',
            ChatBoxMessage: 'Off',
            Blocked: 'On',
            Unblocked: 'On',
            Muted: 'On',
            Unmuted: 'On'
        }
    };
    $app.data.sharedFeedFilters = JSON.parse(
        await configRepository.getString(
            'sharedFeedFilters',
            JSON.stringify(sharedFeedFilters)
        )
    );
    if (!$app.data.sharedFeedFilters.noty.Blocked) {
        $app.data.sharedFeedFilters.noty.Blocked = 'Off';
        $app.data.sharedFeedFilters.noty.Unblocked = 'Off';
        $app.data.sharedFeedFilters.noty.Muted = 'Off';
        $app.data.sharedFeedFilters.noty.Unmuted = 'Off';
        $app.data.sharedFeedFilters.wrist.Blocked = 'On';
        $app.data.sharedFeedFilters.wrist.Unblocked = 'On';
        $app.data.sharedFeedFilters.wrist.Muted = 'On';
        $app.data.sharedFeedFilters.wrist.Unmuted = 'On';
    }
    if (!$app.data.sharedFeedFilters.noty['group.announcement']) {
        $app.data.sharedFeedFilters.noty['group.announcement'] = 'On';
        $app.data.sharedFeedFilters.noty['group.informative'] = 'On';
        $app.data.sharedFeedFilters.noty['group.invite'] = 'On';
        $app.data.sharedFeedFilters.noty['group.joinRequest'] = 'Off';
        $app.data.sharedFeedFilters.wrist['group.announcement'] = 'On';
        $app.data.sharedFeedFilters.wrist['group.informative'] = 'On';
        $app.data.sharedFeedFilters.wrist['group.invite'] = 'On';
        $app.data.sharedFeedFilters.wrist['group.joinRequest'] = 'On';
    }
    if (!$app.data.sharedFeedFilters.noty['group.queueReady']) {
        $app.data.sharedFeedFilters.noty['group.queueReady'] = 'On';
        $app.data.sharedFeedFilters.wrist['group.queueReady'] = 'On';
    }
    if (!$app.data.sharedFeedFilters.noty.External) {
        $app.data.sharedFeedFilters.noty.External = 'On';
        $app.data.sharedFeedFilters.wrist.External = 'On';
    }

    $app.data.trustColor = JSON.parse(
        await configRepository.getString(
            'VRCX_trustColor',
            JSON.stringify({
                untrusted: '#CCCCCC',
                basic: '#1778FF',
                known: '#2BCF5C',
                trusted: '#FF7B42',
                veteran: '#B18FFF',
                vip: '#FF2626',
                troll: '#782F2F'
            })
        )
    );

    $app.methods.updatetrustColor = async function () {
        if (typeof API.currentUser?.id === 'undefined') {
            return;
        }
        await configRepository.setBool(
            'VRCX_randomUserColours',
            this.randomUserColours
        );
        await configRepository.setString(
            'VRCX_trustColor',
            JSON.stringify(this.trustColor)
        );
        if (this.randomUserColours) {
            this.getNameColour(API.currentUser.id).then((colour) => {
                API.currentUser.$userColour = colour;
            });
            this.userColourInit();
        } else {
            API.applyUserTrustLevel(API.currentUser);
            API.cachedUsers.forEach((ref) => {
                API.applyUserTrustLevel(ref);
            });
        }
        await this.updatetrustColorClasses();
    };

    $app.methods.updatetrustColorClasses = async function () {
        var trustColor = JSON.parse(
            await configRepository.getString(
                'VRCX_trustColor',
                JSON.stringify({
                    untrusted: '#CCCCCC',
                    basic: '#1778FF',
                    known: '#2BCF5C',
                    trusted: '#FF7B42',
                    veteran: '#B18FFF',
                    vip: '#FF2626',
                    troll: '#782F2F'
                })
            )
        );
        if (document.getElementById('trustColor') !== null) {
            document.getElementById('trustColor').outerHTML = '';
        }
        var style = document.createElement('style');
        style.id = 'trustColor';
        style.type = 'text/css';
        var newCSS = '';
        for (var rank in trustColor) {
            newCSS += `.x-tag-${rank} { color: ${trustColor[rank]} !important; border-color: ${trustColor[rank]} !important; } `;
        }
        style.innerHTML = newCSS;
        document.getElementsByTagName('head')[0].appendChild(style);
    };
    await $app.methods.updatetrustColorClasses();

    $app.methods.saveSharedFeedFilters = async function () {
        this.notyFeedFiltersDialog.visible = false;
        this.wristFeedFiltersDialog.visible = false;
        await configRepository.setString(
            'sharedFeedFilters',
            JSON.stringify(this.sharedFeedFilters)
        );
        this.updateSharedFeed(true);
    };

    $app.methods.cancelSharedFeedFilters = async function () {
        this.notyFeedFiltersDialog.visible = false;
        this.wristFeedFiltersDialog.visible = false;
        this.sharedFeedFilters = JSON.parse(
            await configRepository.getString('sharedFeedFilters')
        );
    };

    $app.data.notificationPosition = await configRepository.getString(
        'VRCX_notificationPosition',
        'topCenter'
    );
    $app.methods.changeNotificationPosition = async function () {
        await configRepository.setString(
            'VRCX_notificationPosition',
            this.notificationPosition
        );
        this.updateVRConfigVars();
    };

    $app.data.youTubeApi = await configRepository.getBool(
        'VRCX_youtubeAPI',
        false
    );
    $app.data.youTubeApiKey = await configRepository.getString(
        'VRCX_youtubeAPIKey',
        ''
    );

    $app.data.progressPie = await configRepository.getBool(
        'VRCX_progressPie',
        false
    );
    $app.data.progressPieFilter = await configRepository.getBool(
        'VRCX_progressPieFilter',
        true
    );

    $app.data.screenshotHelper = await configRepository.getBool(
        'VRCX_screenshotHelper',
        true
    );

    $app.data.screenshotHelperModifyFilename = await configRepository.getBool(
        'VRCX_screenshotHelperModifyFilename',
        false
    );

    $app.data.screenshotHelperCopyToClipboard = await configRepository.getBool(
        'VRCX_screenshotHelperCopyToClipboard',
        false
    );

    $app.data.enableAppLauncher = await configRepository.getBool(
        'VRCX_enableAppLauncher',
        true
    );

    $app.data.enableAppLauncherAutoClose = await configRepository.getBool(
        'VRCX_enableAppLauncherAutoClose',
        true
    );

    $app.methods.updateVRConfigVars = function () {
        var notificationTheme = 'relax';
        if (this.isDarkMode) {
            notificationTheme = 'sunset';
        }
        var VRConfigVars = {
            overlayNotifications: this.overlayNotifications,
            hideDevicesFromFeed: this.hideDevicesFromFeed,
            hideCpuUsageFromFeed: this.hideCpuUsageFromFeed,
            minimalFeed: this.minimalFeed,
            notificationPosition: this.notificationPosition,
            notificationTimeout: this.notificationTimeout,
            photonOverlayMessageTimeout: this.photonOverlayMessageTimeout,
            notificationTheme,
            backgroundEnabled: this.vrBackgroundEnabled,
            dtHour12: this.dtHour12,
            pcUptimeOnFeed: this.pcUptimeOnFeed,
            appLanguage: this.appLanguage
        };
        var json = JSON.stringify(VRConfigVars);
        AppApi.ExecuteVrFeedFunction('configUpdate', json);
        AppApi.ExecuteVrOverlayFunction('configUpdate', json);
    };

    $app.methods.isRpcWorld = function (location) {
        var rpcWorlds = [
            'wrld_f20326da-f1ac-45fc-a062-609723b097b1',
            'wrld_42377cf1-c54f-45ed-8996-5875b0573a83',
            'wrld_dd6d2888-dbdc-47c2-bc98-3d631b2acd7c',
            'wrld_52bdcdab-11cd-4325-9655-0fb120846945',
            'wrld_2d40da63-8f1f-4011-8a9e-414eb8530acd',
            'wrld_1b68f7a8-8aea-4900-b7a2-3fc4139ac817',
            'wrld_10e5e467-fc65-42ed-8957-f02cace1398c',
            'wrld_04899f23-e182-4a8d-b2c7-2c74c7c15534',
            'wrld_791ebf58-54ce-4d3a-a0a0-39f10e1b20b2',
            'wrld_86a09fce-a34e-4deb-81be-53c843f97e98',
            'wrld_435bbf25-f34f-4b8b-82c6-cd809057eb8e',
            'wrld_db9d878f-6e76-4776-8bf2-15bcdd7fc445'
        ];
        var L = API.parseLocation(location);
        if (rpcWorlds.includes(L.worldId)) {
            return true;
        }
        return false;
    };

    $app.methods.updateVRLastLocation = function () {
        var progressPie = false;
        if (this.progressPie) {
            progressPie = true;
            if (this.progressPieFilter) {
                if (!this.isRpcWorld(this.lastLocation.location)) {
                    progressPie = false;
                }
            }
        }
        var onlineFor = '';
        if (!this.hideUptimeFromFeed) {
            onlineFor = API.currentUser.$online_for;
        }
        var lastLocation = {
            date: this.lastLocation.date,
            location: this.lastLocation.location,
            name: this.lastLocation.name,
            playerList: Array.from(this.lastLocation.playerList.values()),
            friendList: Array.from(this.lastLocation.friendList.values()),
            progressPie,
            onlineFor
        };
        var json = JSON.stringify(lastLocation);
        AppApi.ExecuteVrFeedFunction('lastLocationUpdate', json);
        AppApi.ExecuteVrOverlayFunction('lastLocationUpdate', json);
    };

    $app.methods.vrInit = function () {
        this.updateVRConfigVars();
        this.updateVRLastLocation();
        this.updateVrNowPlaying();
        this.updateSharedFeed(true);
        this.onlineFriendCount = 0;
        this.updateOnlineFriendCoutner();
    };

    API.$on('LOGIN', function () {
        $app.currentUserTreeData = [];
        $app.pastDisplayNameTable.data = [];
    });

    API.$on('USER:CURRENT', function (args) {
        if (args.ref.pastDisplayNames) {
            $app.pastDisplayNameTable.data = args.ref.pastDisplayNames;
        }
    });

    API.$on('VISITS', function (args) {
        $app.visits = args.json;
    });

    $app.methods.logout = function () {
        this.$confirm('Continue? Logout', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    API.logout();
                }
            }
        });
    };

    $app.methods.resetHome = function () {
        this.$confirm('Continue? Reset Home', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    API.saveCurrentUser({
                        homeLocation: ''
                    }).then((args) => {
                        this.$message({
                            message: 'Home world has been reset',
                            type: 'success'
                        });
                        return args;
                    });
                }
            }
        });
    };

    $app.methods.updateOpenVR = function () {
        if (
            this.openVR &&
            this.isSteamVRRunning &&
            ((this.isGameRunning && !this.isGameNoVR) || this.openVRAlways)
        ) {
            var hmdOverlay = false;
            if (
                this.overlayNotifications ||
                this.progressPie ||
                this.photonEventOverlay ||
                this.timeoutHudOverlay
            ) {
                hmdOverlay = true;
            }
            // active, hmdOverlay, wristOverlay, menuButton, overlayHand
            AppApi.SetVR(
                true,
                hmdOverlay,
                this.overlayWrist,
                this.overlaybutton,
                this.overlayHand
            );
        } else {
            AppApi.SetVR(false, false, false, false, 0);
        }
    };

    $app.methods.getTTSVoiceName = function () {
        var voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            return '';
        }
        if (this.notificationTTSVoice >= voices.length) {
            this.notificationTTSVoice = 0;
            configRepository.setString(
                'VRCX_notificationTTSVoice',
                this.notificationTTSVoice
            );
        }
        return voices[this.notificationTTSVoice].name;
    };

    $app.methods.changeTTSVoice = async function (index) {
        this.notificationTTSVoice = index;
        await configRepository.setString(
            'VRCX_notificationTTSVoice',
            this.notificationTTSVoice
        );
        var voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            return;
        }
        var voiceName = voices[index].name;
        speechSynthesis.cancel();
        this.speak(voiceName);
    };

    $app.methods.speak = function (text) {
        var tts = new SpeechSynthesisUtterance();
        var voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            return;
        }
        var index = 0;
        if (this.notificationTTSVoice < voices.length) {
            index = this.notificationTTSVoice;
        }
        tts.voice = voices[index];
        tts.text = text;
        speechSynthesis.speak(tts);
    };

    $app.methods.refreshConfigTreeData = function () {
        this.configTreeData = buildTreeData(API.cachedConfig);
    };

    $app.methods.refreshCurrentUserTreeData = function () {
        this.currentUserTreeData = buildTreeData(API.currentUser);
    };

    $app.methods.promptUserIdDialog = function () {
        this.$prompt(
            $t('prompt.direct_access_user_id.description'),
            $t('prompt.direct_access_user_id.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.direct_access_user_id.ok'),
                cancelButtonText: $t('prompt.direct_access_user_id.cancel'),
                inputPattern: /\S+/,
                inputErrorMessage: $t(
                    'prompt.direct_access_user_id.input_error'
                ),
                callback: (action, instance) => {
                    if (action === 'confirm' && instance.inputValue) {
                        var testUrl = instance.inputValue.substring(0, 15);
                        if (testUrl === 'https://vrchat.') {
                            var userId = this.parseUserUrl(instance.inputValue);
                            if (userId) {
                                this.showUserDialog(userId);
                            } else {
                                this.$message({
                                    message: $t(
                                        'prompt.direct_access_user_id.message.error'
                                    ),
                                    type: 'error'
                                });
                            }
                        } else {
                            this.showUserDialog(instance.inputValue);
                        }
                    }
                }
            }
        );
    };

    $app.methods.promptUsernameDialog = function () {
        this.$prompt(
            $t('prompt.direct_access_username.description'),
            $t('prompt.direct_access_username.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.direct_access_username.ok'),
                cancelButtonText: $t('prompt.direct_access_username.cancel'),
                inputPattern: /\S+/,
                inputErrorMessage: $t(
                    'prompt.direct_access_username.input_error'
                ),
                callback: (action, instance) => {
                    if (action === 'confirm' && instance.inputValue) {
                        this.lookupUser({ displayName: instance.inputValue });
                    }
                }
            }
        );
    };

    $app.methods.promptWorldDialog = function () {
        this.$prompt(
            $t('prompt.direct_access_world_id.description'),
            $t('prompt.direct_access_world_id.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.direct_access_world_id.ok'),
                cancelButtonText: $t('prompt.direct_access_world_id.cancel'),
                inputPattern: /\S+/,
                inputErrorMessage: $t(
                    'prompt.direct_access_world_id.input_error'
                ),
                callback: (action, instance) => {
                    if (action === 'confirm' && instance.inputValue) {
                        if (!this.directAccessWorld(instance.inputValue)) {
                            this.$message({
                                message: $t(
                                    'prompt.direct_access_world_id.message.error'
                                ),
                                type: 'error'
                            });
                        }
                    }
                }
            }
        );
    };

    $app.methods.promptAvatarDialog = function () {
        this.$prompt(
            $t('prompt.direct_access_avatar_id.description'),
            $t('prompt.direct_access_avatar_id.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.direct_access_avatar_id.ok'),
                cancelButtonText: $t('prompt.direct_access_avatar_id.cancel'),
                inputPattern: /\S+/,
                inputErrorMessage: $t(
                    'prompt.direct_access_avatar_id.input_error'
                ),
                callback: (action, instance) => {
                    if (action === 'confirm' && instance.inputValue) {
                        var testUrl = instance.inputValue.substring(0, 15);
                        if (testUrl === 'https://vrchat.') {
                            var avatarId = this.parseAvatarUrl(
                                instance.inputValue
                            );
                            if (avatarId) {
                                this.showAvatarDialog(avatarId);
                            } else {
                                this.$message({
                                    message: $t(
                                        'prompt.direct_access_avatar_id.message.error'
                                    ),
                                    type: 'error'
                                });
                            }
                        } else {
                            this.showAvatarDialog(instance.inputValue);
                        }
                    }
                }
            }
        );
    };

    $app.methods.promptOmniDirectDialog = function () {
        this.$prompt(
            $t('prompt.direct_access_omni.description'),
            $t('prompt.direct_access_omni.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.direct_access_omni.ok'),
                cancelButtonText: $t('prompt.direct_access_omni.cancel'),
                inputPattern: /\S+/,
                inputErrorMessage: $t('prompt.direct_access_omni.input_error'),
                callback: (action, instance) => {
                    if (action === 'confirm' && instance.inputValue) {
                        var input = instance.inputValue.trim();
                        if (!this.directAccessParse(input)) {
                            this.$message({
                                message: $t(
                                    'prompt.direct_access_omni.message.error'
                                ),
                                type: 'error'
                            });
                        }
                    }
                }
            }
        );
    };

    $app.methods.directAccessPaste = function () {
        AppApi.GetClipboard().then((clipboard) => {
            if (!this.directAccessParse(clipboard.trim())) {
                this.promptOmniDirectDialog();
            }
        });
    };

    $app.methods.directAccessWorld = function (textBoxInput) {
        var input = textBoxInput;
        if (input.startsWith('/home/')) {
            input = `https://vrchat.com${input}`;
        }
        if (input.length === 8) {
            return this.verifyShortName('', input);
        } else if (input.startsWith('https://vrch.at/')) {
            var shortName = input.substring(16, 24);
            return this.verifyShortName('', shortName);
        } else if (
            input.startsWith('https://vrchat.') ||
            input.startsWith('/home/')
        ) {
            var url = new URL(input);
            var urlPath = url.pathname;
            if (urlPath.substring(5, 12) === '/world/') {
                var worldId = urlPath.substring(12);
                this.showWorldDialog(worldId);
                return true;
            } else if (urlPath.substring(5, 12) === '/launch') {
                var urlParams = new URLSearchParams(url.search);
                var worldId = urlParams.get('worldId');
                var instanceId = urlParams.get('instanceId');
                if (instanceId) {
                    var shortName = urlParams.get('shortName');
                    var location = `${worldId}:${instanceId}`;
                    if (shortName) {
                        return this.verifyShortName(location, shortName);
                    }
                    this.showWorldDialog(location);
                    return true;
                } else if (worldId) {
                    this.showWorldDialog(worldId);
                    return true;
                }
            }
        } else if (input.substring(0, 5) === 'wrld_') {
            // a bit hacky, but supports weird malformed inputs cut out from url, why not
            if (input.indexOf('&instanceId=') >= 0) {
                input = `https://vrchat.com/home/launch?worldId=${input}`;
                return this.directAccessWorld(input);
            }
            this.showWorldDialog(input.trim());
            return true;
        }
        return false;
    };

    $app.methods.verifyShortName = function (location, shortName) {
        return API.getInstanceFromShortName({ shortName }).then((args) => {
            var newLocation = args.json.location;
            var newShortName = args.json.shortName;
            if (newShortName) {
                this.showWorldDialog(newLocation, newShortName);
            } else if (newLocation) {
                this.showWorldDialog(newLocation);
            } else {
                this.showWorldDialog(location);
            }
            return args;
        });
    };

    $app.methods.showGroupDialogShortCode = function (shortCode) {
        API.groupStrictsearch({ query: shortCode }).then((args) => {
            for (var group of args.json) {
                if (`${group.shortCode}.${group.discriminator}` === shortCode) {
                    this.showGroupDialog(group.id);
                }
            }
            return args;
        });
    };

    $app.methods.directAccessParse = function (input) {
        if (!input) {
            return false;
        }
        if (this.directAccessWorld(input)) {
            return true;
        }
        if (input.startsWith('https://vrchat.')) {
            var url = new URL(input);
            var urlPath = url.pathname;
            if (urlPath.substring(5, 11) === '/user/') {
                var userId = urlPath.substring(11);
                this.showUserDialog(userId);
                return true;
            } else if (urlPath.substring(5, 13) === '/avatar/') {
                var avatarId = urlPath.substring(13);
                this.showAvatarDialog(avatarId);
                return true;
            } else if (urlPath.substring(5, 12) === '/group/') {
                var groupId = urlPath.substring(12);
                this.showGroupDialog(groupId);
                return true;
            }
        } else if (input.startsWith('https://vrc.group/')) {
            var shortCode = input.substring(18);
            this.showGroupDialogShortCode(shortCode);
            return true;
        } else if (/^[A-Za-z0-9]{3,6}\.[0-9]{4}$/g.test(input)) {
            this.showGroupDialogShortCode(input);
            return true;
        } else if (
            input.substring(0, 4) === 'usr_' ||
            /^[A-Za-z0-9]{10}$/g.test(input)
        ) {
            this.showUserDialog(input);
            return true;
        } else if (input.substring(0, 5) === 'avtr_') {
            this.showAvatarDialog(input);
            return true;
        } else if (input.substring(0, 4) === 'grp_') {
            this.showGroupDialog(input);
            return true;
        }
        return false;
    };

    $app.methods.promptNotificationTimeout = function () {
        this.$prompt(
            $t('prompt.notification_timeout.description'),
            $t('prompt.notification_timeout.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.notification_timeout.ok'),
                cancelButtonText: $t('prompt.notification_timeout.cancel'),
                inputValue: this.notificationTimeout / 1000,
                inputPattern: /\d+$/,
                inputErrorMessage: $t(
                    'prompt.notification_timeout.input_error'
                ),
                callback: async (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue &&
                        !isNaN(instance.inputValue)
                    ) {
                        this.notificationTimeout = Math.trunc(
                            Number(instance.inputValue) * 1000
                        );
                        await configRepository.setString(
                            'VRCX_notificationTimeout',
                            this.notificationTimeout
                        );
                        this.updateVRConfigVars();
                    }
                }
            }
        );
    };

    $app.methods.promptPhotonOverlayMessageTimeout = function () {
        this.$prompt(
            $t('prompt.overlay_message_timeout.description'),
            $t('prompt.overlay_message_timeout.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.overlay_message_timeout.ok'),
                cancelButtonText: $t('prompt.overlay_message_timeout.cancel'),
                inputValue: this.photonOverlayMessageTimeout / 1000,
                inputPattern: /\d+$/,
                inputErrorMessage: $t(
                    'prompt.overlay_message_timeout.input_error'
                ),
                callback: async (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue &&
                        !isNaN(instance.inputValue)
                    ) {
                        this.photonOverlayMessageTimeout = Math.trunc(
                            Number(instance.inputValue) * 1000
                        );
                        await configRepository.setString(
                            'VRCX_photonOverlayMessageTimeout',
                            this.photonOverlayMessageTimeout
                        );
                        this.updateVRConfigVars();
                    }
                }
            }
        );
    };

    $app.methods.promptRenameAvatar = function (avatar) {
        this.$prompt(
            $t('prompt.rename_avatar.description'),
            $t('prompt.rename_avatar.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.rename_avatar.ok'),
                cancelButtonText: $t('prompt.rename_avatar.cancel'),
                inputValue: avatar.ref.name,
                inputErrorMessage: $t('prompt.rename_avatar.input_error'),
                callback: (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue !== avatar.ref.name
                    ) {
                        API.saveAvatar({
                            id: avatar.id,
                            name: instance.inputValue
                        }).then((args) => {
                            this.$message({
                                message: $t(
                                    'prompt.rename_avatar.message.success'
                                ),
                                type: 'success'
                            });
                            return args;
                        });
                    }
                }
            }
        );
    };

    $app.methods.promptChangeAvatarDescription = function (avatar) {
        this.$prompt(
            $t('prompt.change_avatar_description.description'),
            $t('prompt.change_avatar_description.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.change_avatar_description.ok'),
                cancelButtonText: $t('prompt.change_avatar_description.cancel'),
                inputValue: avatar.ref.description,
                inputErrorMessage: $t(
                    'prompt.change_avatar_description.input_error'
                ),
                callback: (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue !== avatar.ref.description
                    ) {
                        API.saveAvatar({
                            id: avatar.id,
                            description: instance.inputValue
                        }).then((args) => {
                            this.$message({
                                message: $t(
                                    'prompt.change_avatar_description.message.success'
                                ),
                                type: 'success'
                            });
                            return args;
                        });
                    }
                }
            }
        );
    };

    $app.methods.promptRenameWorld = function (world) {
        this.$prompt(
            $t('prompt.rename_world.description'),
            $t('prompt.rename_world.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.rename_world.ok'),
                cancelButtonText: $t('prompt.rename_world.cancel'),
                inputValue: world.ref.name,
                inputErrorMessage: $t('prompt.rename_world.input_error'),
                callback: (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue !== world.ref.name
                    ) {
                        API.saveWorld({
                            id: world.id,
                            name: instance.inputValue
                        }).then((args) => {
                            this.$message({
                                message: $t(
                                    'prompt.rename_world.message.success'
                                ),
                                type: 'success'
                            });
                            return args;
                        });
                    }
                }
            }
        );
    };

    $app.methods.promptChangeWorldDescription = function (world) {
        this.$prompt(
            $t('prompt.change_world_description.description'),
            $t('prompt.change_world_description.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.change_world_description.ok'),
                cancelButtonText: $t('prompt.change_world_description.cancel'),
                inputValue: world.ref.description,
                inputErrorMessage: $t(
                    'prompt.change_world_description.input_error'
                ),
                callback: (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue !== world.ref.description
                    ) {
                        API.saveWorld({
                            id: world.id,
                            description: instance.inputValue
                        }).then((args) => {
                            this.$message({
                                message: $t(
                                    'prompt.change_world_description.message.success'
                                ),
                                type: 'success'
                            });
                            return args;
                        });
                    }
                }
            }
        );
    };

    $app.methods.promptChangeWorldCapacity = function (world) {
        this.$prompt(
            $t('prompt.change_world_capacity.description'),
            $t('prompt.change_world_capacity.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.change_world_capacity.ok'),
                cancelButtonText: $t('prompt.change_world_capacity.cancel'),
                inputValue: world.ref.capacity,
                inputPattern: /\d+$/,
                inputErrorMessage: $t(
                    'prompt.change_world_capacity.input_error'
                ),
                callback: (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue !== world.ref.capacity
                    ) {
                        API.saveWorld({
                            id: world.id,
                            capacity: instance.inputValue
                        }).then((args) => {
                            this.$message({
                                message: $t(
                                    'prompt.change_world_capacity.message.success'
                                ),
                                type: 'success'
                            });
                            return args;
                        });
                    }
                }
            }
        );
    };

    $app.methods.promptChangeWorldRecommendedCapacity = function (world) {
        this.$prompt(
            $t('prompt.change_world_recommended_capacity.description'),
            $t('prompt.change_world_recommended_capacity.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.change_world_capacity.ok'),
                cancelButtonText: $t('prompt.change_world_capacity.cancel'),
                inputValue: world.ref.recommendedCapacity,
                inputPattern: /\d+$/,
                inputErrorMessage: $t(
                    'prompt.change_world_recommended_capacity.input_error'
                ),
                callback: (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue !== world.ref.recommendedCapacity
                    ) {
                        API.saveWorld({
                            id: world.id,
                            recommendedCapacity: instance.inputValue
                        }).then((args) => {
                            this.$message({
                                message: $t(
                                    'prompt.change_world_recommended_capacity.message.success'
                                ),
                                type: 'success'
                            });
                            return args;
                        });
                    }
                }
            }
        );
    };

    $app.methods.promptChangeWorldYouTubePreview = function (world) {
        this.$prompt(
            $t('prompt.change_world_preview.description'),
            $t('prompt.change_world_preview.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.change_world_preview.ok'),
                cancelButtonText: $t('prompt.change_world_preview.cancel'),
                inputValue: world.ref.previewYoutubeId,
                inputErrorMessage: $t(
                    'prompt.change_world_preview.input_error'
                ),
                callback: (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue !== world.ref.previewYoutubeId
                    ) {
                        if (instance.inputValue.length > 11) {
                            try {
                                var url = new URL(instance.inputValue);
                                var id1 = url.pathname;
                                var id2 = url.searchParams.get('v');
                                if (id1 && id1.length === 12) {
                                    instance.inputValue = id1.substring(1, 12);
                                }
                                if (id2 && id2.length === 11) {
                                    instance.inputValue = id2;
                                }
                            } catch {
                                this.$message({
                                    message: $t(
                                        'prompt.change_world_preview.message.error'
                                    ),
                                    type: 'error'
                                });
                                return;
                            }
                        }
                        if (
                            instance.inputValue !== world.ref.previewYoutubeId
                        ) {
                            API.saveWorld({
                                id: world.id,
                                previewYoutubeId: instance.inputValue
                            }).then((args) => {
                                this.$message({
                                    message: $t(
                                        'prompt.change_world_preview.message.success'
                                    ),
                                    type: 'success'
                                });
                                return args;
                            });
                        }
                    }
                }
            }
        );
    };

    $app.methods.promptMaxTableSizeDialog = function () {
        this.$prompt(
            $t('prompt.change_table_size.description'),
            $t('prompt.change_table_size.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.change_table_size.save'),
                cancelButtonText: $t('prompt.change_table_size.cancel'),
                inputValue: this.maxTableSize,
                inputPattern: /\d+$/,
                inputErrorMessage: $t('prompt.change_table_size.input_error'),
                callback: async (action, instance) => {
                    if (action === 'confirm' && instance.inputValue) {
                        if (instance.inputValue > 10000) {
                            instance.inputValue = 10000;
                        }
                        this.maxTableSize = instance.inputValue;
                        await configRepository.setString(
                            'VRCX_maxTableSize',
                            this.maxTableSize
                        );
                        database.setmaxTableSize(this.maxTableSize);
                        this.feedTableLookup();
                        this.gameLogTableLookup();
                    }
                }
            }
        );
    };

    $app.methods.setTablePageSize = async function (pageSize) {
        this.tablePageSize = pageSize;
        this.feedTable.pageSize = pageSize;
        this.gameLogTable.pageSize = pageSize;
        this.friendLogTable.pageSize = pageSize;
        this.playerModerationTable.pageSize = pageSize;
        this.notificationTable.pageSize = pageSize;
        await configRepository.setInt('VRCX_tablePageSize', pageSize);
    };

    $app.methods.promptPhotonLobbyTimeoutThreshold = function () {
        this.$prompt(
            $t('prompt.photon_lobby_timeout.description'),
            $t('prompt.photon_lobby_timeout.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.photon_lobby_timeout.ok'),
                cancelButtonText: $t('prompt.photon_lobby_timeout.cancel'),
                inputValue: this.photonLobbyTimeoutThreshold / 1000,
                inputPattern: /\d+$/,
                inputErrorMessage: $t(
                    'prompt.photon_lobby_timeout.input_error'
                ),
                callback: async (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue &&
                        !isNaN(instance.inputValue)
                    ) {
                        this.photonLobbyTimeoutThreshold = Math.trunc(
                            Number(instance.inputValue) * 1000
                        );
                        await configRepository.setString(
                            'VRCX_photonLobbyTimeoutThreshold',
                            this.photonLobbyTimeoutThreshold
                        );
                    }
                }
            }
        );
    };

    $app.methods.promptAutoClearVRCXCacheFrequency = function () {
        this.$prompt(
            $t('prompt.auto_clear_cache.description'),
            $t('prompt.auto_clear_cache.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.auto_clear_cache.ok'),
                cancelButtonText: $t('prompt.auto_clear_cache.cancel'),
                inputValue: this.clearVRCXCacheFrequency / 3600 / 2,
                inputPattern: /\d+$/,
                inputErrorMessage: $t('prompt.auto_clear_cache.input_error'),
                callback: async (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue &&
                        !isNaN(instance.inputValue)
                    ) {
                        this.clearVRCXCacheFrequency = Math.trunc(
                            Number(instance.inputValue) * 3600 * 2
                        );
                        await configRepository.setString(
                            'VRCX_clearVRCXCacheFrequency',
                            this.clearVRCXCacheFrequency
                        );
                    }
                }
            }
        );
    };

    // #endregion
    // #region | App: Dialog

    var adjustDialogZ = (el) => {
        var z = 0;
        document
            .querySelectorAll('.v-modal,.el-dialog__wrapper')
            .forEach((v) => {
                var _z = Number(v.style.zIndex) || 0;
                if (_z && _z > z && v !== el) {
                    z = _z;
                }
            });
        if (z) {
            el.style.zIndex = z + 1;
        }
    };

    // #endregion
    // #region | App: User Dialog

    $app.data.userDialogWorldSortingOptions = {
        updated: {
            name: $t('dialog.user.worlds.sorting.updated'),
            value: 'updated'
        },
        created: {
            name: $t('dialog.user.worlds.sorting.created'),
            value: 'created'
        },
        favorites: {
            name: $t('dialog.user.worlds.sorting.favorites'),
            value: 'favorites'
        },
        popularity: {
            name: $t('dialog.user.worlds.sorting.popularity'),
            value: 'popularity'
        }
    };

    $app.data.userDialogWorldOrderOptions = {
        descending: {
            name: $t('dialog.user.worlds.order.descending'),
            value: 'descending'
        },
        ascending: {
            name: $t('dialog.user.worlds.order.ascending'),
            value: 'ascending'
        }
    };

    $app.data.userDialog = {
        visible: false,
        loading: false,
        id: '',
        ref: {},
        friend: {},
        isFriend: false,
        note: '',
        noteSaving: false,
        incomingRequest: false,
        outgoingRequest: false,
        isBlock: false,
        isMute: false,
        isHideAvatar: false,
        isShowAvatar: false,
        isInteractOff: false,
        isFavorite: false,

        $location: {},
        $homeLocationName: '',
        users: [],
        instance: {},

        worlds: [],
        avatars: [],
        isWorldsLoading: false,
        isFavoriteWorldsLoading: false,
        isAvatarsLoading: false,
        isGroupsLoading: false,

        worldSorting: $app.data.userDialogWorldSortingOptions.updated,
        worldOrder: $app.data.userDialogWorldOrderOptions.descending,
        avatarSorting: 'update',
        avatarReleaseStatus: 'all',

        treeData: [],
        memo: '',
        $avatarInfo: {
            ownerId: '',
            avatarName: '',
            fileCreatedAt: ''
        },
        representedGroup: {
            bannerUrl: '',
            description: '',
            discriminator: '',
            groupId: '',
            iconUrl: '',
            isRepresenting: false,
            memberCount: 0,
            memberVisibility: '',
            name: '',
            ownerId: '',
            privacy: '',
            shortCode: ''
        },
        joinCount: 0,
        timeSpent: 0,
        lastSeen: '',
        avatarModeration: 0,
        previousDisplayNames: [],
        dateFriended: '',
        unFriended: false,
        dateFriendedInfo: []
    };

    $app.data.ignoreUserMemoSave = false;

    $app.watch['userDialog.memo'] = function () {
        if (this.ignoreUserMemoSave) {
            this.ignoreUserMemoSave = false;
            return;
        }
        var D = this.userDialog;
        this.saveMemo(D.id, D.memo);
    };

    $app.methods.setUserDialogWorldSorting = async function (sortOrder) {
        var D = this.userDialog;
        if (D.worldSorting === sortOrder) {
            return;
        }
        D.worldSorting = sortOrder;
        await this.refreshUserDialogWorlds();
    };

    $app.methods.setUserDialogWorldOrder = async function (order) {
        var D = this.userDialog;
        if (D.worldOrder === order) {
            return;
        }
        D.worldOrder = order;
        await this.refreshUserDialogWorlds();
    };

    $app.methods.getFaviconUrl = function (resource) {
        try {
            var url = new URL(resource);
            return `https://icons.duckduckgo.com/ip2/${url.host}.ico`;
        } catch (err) {
            return '';
        }
    };

    API.$on('LOGOUT', function () {
        $app.userDialog.visible = false;
    });

    API.$on('USER', function (args) {
        var { ref } = args;
        var D = $app.userDialog;
        if (D.visible === false || D.id !== ref.id) {
            return;
        }
        D.ref = ref;
        D.note = String(ref.note || '');
        D.noteSaving = false;
        D.incomingRequest = false;
        D.outgoingRequest = false;
        if (D.ref.friendRequestStatus === 'incoming') {
            D.incomingRequest = true;
        } else if (D.ref.friendRequestStatus === 'outgoing') {
            D.outgoingRequest = true;
        }
    });

    API.$on('WORLD', function (args) {
        var D = $app.userDialog;
        if (D.visible === false || D.$location.worldId !== args.ref.id) {
            return;
        }
        $app.applyUserDialogLocation();
    });

    API.$on('FRIEND:STATUS', function (args) {
        var D = $app.userDialog;
        if (D.visible === false || D.id !== args.params.userId) {
            return;
        }
        var { json } = args;
        D.isFriend = json.isFriend;
        D.incomingRequest = json.incomingRequest;
        D.outgoingRequest = json.outgoingRequest;
    });

    API.$on('FRIEND:REQUEST', function (args) {
        var D = $app.userDialog;
        if (D.visible === false || D.id !== args.params.userId) {
            return;
        }
        if (args.json.success) {
            D.isFriend = true;
        } else {
            D.outgoingRequest = true;
        }
    });

    API.$on('FRIEND:REQUEST:CANCEL', function (args) {
        var D = $app.userDialog;
        if (D.visible === false || D.id !== args.params.userId) {
            return;
        }
        D.outgoingRequest = false;
    });

    API.$on('NOTIFICATION', function (args) {
        var { ref } = args;
        var D = $app.userDialog;
        if (
            D.visible === false ||
            ref.$isDeleted ||
            ref.type !== 'friendRequest' ||
            ref.senderUserId !== D.id
        ) {
            return;
        }
        D.incomingRequest = true;
    });

    API.$on('NOTIFICATION:ACCEPT', function (args) {
        var { ref } = args;
        var D = $app.userDialog;
        // 얘는 @DELETE가 오고나서 ACCEPT가 옴
        // 따라서 $isDeleted라면 ref가 undefined가 됨
        if (
            D.visible === false ||
            typeof ref === 'undefined' ||
            ref.type !== 'friendRequest' ||
            ref.senderUserId !== D.id
        ) {
            return;
        }
        D.isFriend = true;
    });

    API.$on('NOTIFICATION:EXPIRE', function (args) {
        var { ref } = args;
        var D = $app.userDialog;
        if (
            D.visible === false ||
            ref.type !== 'friendRequest' ||
            ref.senderUserId !== D.id
        ) {
            return;
        }
        D.incomingRequest = false;
    });

    API.$on('FRIEND:DELETE', function (args) {
        var D = $app.userDialog;
        if (D.visible === false || D.id !== args.params.userId) {
            return;
        }
        D.isFriend = false;
    });

    API.$on('PLAYER-MODERATION:@SEND', function (args) {
        var { ref } = args;
        var D = $app.userDialog;
        if (
            D.visible === false ||
            ref.$isDeleted ||
            (ref.targetUserId !== D.id &&
                ref.sourceUserId !== this.currentUser.id)
        ) {
            return;
        }
        if (ref.type === 'block') {
            D.isBlock = true;
        } else if (ref.type === 'mute') {
            D.isMute = true;
        } else if (ref.type === 'hideAvatar') {
            D.isHideAvatar = true;
        } else if (ref.type === 'interactOff') {
            D.isInteractOff = true;
        }
        $app.$message({
            message: 'User moderated',
            type: 'success'
        });
    });

    API.$on('PLAYER-MODERATION:@DELETE', function (args) {
        var { ref } = args;
        var D = $app.userDialog;
        if (
            D.visible === false ||
            ref.targetUserId !== D.id ||
            ref.sourceUserId !== this.currentUser.id
        ) {
            return;
        }
        if (ref.type === 'block') {
            D.isBlock = false;
        } else if (ref.type === 'mute') {
            D.isMute = false;
        } else if (ref.type === 'hideAvatar') {
            D.isHideAvatar = false;
        } else if (ref.type === 'interactOff') {
            D.isInteractOff = false;
        }
    });

    API.$on('FAVORITE', function (args) {
        var { ref } = args;
        var D = $app.userDialog;
        if (D.visible === false || ref.$isDeleted || ref.favoriteId !== D.id) {
            return;
        }
        D.isFavorite = true;
    });

    API.$on('FAVORITE:@DELETE', function (args) {
        var D = $app.userDialog;
        if (D.visible === false || D.id !== args.ref.favoriteId) {
            return;
        }
        D.isFavorite = false;
    });

    $app.methods.showUserDialog = function (userId) {
        if (!userId) {
            return;
        }
        this.$nextTick(() => adjustDialogZ(this.$refs.userDialog.$el));
        var D = this.userDialog;
        D.id = userId;
        D.treeData = [];
        this.ignoreUserMemoSave = true;
        D.memo = '';
        D.note = '';
        D.noteSaving = false;
        this.getMemo(userId).then((memo) => {
            if (memo.userId === userId) {
                this.ignoreUserMemoSave = true;
                D.memo = memo.memo;
                var ref = this.friends.get(userId);
                if (ref) {
                    ref.memo = String(memo.memo || '');
                    if (memo.memo) {
                        var array = memo.memo.split('\n');
                        ref.$nickName = array[0];
                    } else {
                        ref.$nickName = '';
                    }
                }
            }
        });
        D.visible = true;
        D.loading = true;
        D.avatars = [];
        D.worlds = [];
        D.instance = {
            id: '',
            tag: '',
            $location: {},
            friendCount: 0,
            users: [],
            shortName: '',
            ref: {}
        };
        D.representedGroup = {
            bannerUrl: '',
            description: '',
            discriminator: '',
            groupId: '',
            iconUrl: '',
            isRepresenting: false,
            memberCount: 0,
            memberVisibility: '',
            name: '',
            ownerId: '',
            privacy: '',
            shortCode: ''
        };
        D.lastSeen = '';
        D.joinCount = 0;
        D.timeSpent = 0;
        D.avatarModeration = 0;
        D.isHideAvatar = false;
        D.isShowAvatar = false;
        D.previousDisplayNames = [];
        D.dateFriended = '';
        D.unFriended = false;
        D.dateFriendedInfo = [];
        if (userId === API.currentUser.id) {
            this.getWorldName(API.currentUser.homeLocation).then(
                (worldName) => {
                    D.$homeLocationName = worldName;
                }
            );
        }
        AppApi.SendIpc('ShowUserDialog', userId);
        API.getCachedUser({
            userId
        })
            .catch((err) => {
                D.loading = false;
                D.visible = false;
                this.$message({
                    message: 'Failed to load user',
                    type: 'error'
                });
                throw err;
            })
            .then((args) => {
                if (args.ref.id === D.id) {
                    D.loading = false;
                    D.ref = args.ref;
                    D.friend = this.friends.get(D.id);
                    D.isFriend = Boolean(D.friend);
                    D.note = String(D.ref.note || '');
                    D.incomingRequest = false;
                    D.outgoingRequest = false;
                    D.isBlock = false;
                    D.isMute = false;
                    D.isInteractOff = false;
                    for (var ref of API.cachedPlayerModerations.values()) {
                        if (
                            ref.$isDeleted === false &&
                            ref.targetUserId === D.id &&
                            ref.sourceUserId === API.currentUser.id
                        ) {
                            if (ref.type === 'block') {
                                D.isBlock = true;
                            } else if (ref.type === 'mute') {
                                D.isMute = true;
                            } else if (ref.type === 'hideAvatar') {
                                D.isHideAvatar = true;
                            } else if (ref.type === 'interactOff') {
                                D.isInteractOff = true;
                            }
                        }
                    }
                    D.isFavorite = API.cachedFavoritesByObjectId.has(D.id);
                    if (D.ref.friendRequestStatus === 'incoming') {
                        D.incomingRequest = true;
                    } else if (D.ref.friendRequestStatus === 'outgoing') {
                        D.outgoingRequest = true;
                    }
                    this.applyUserDialogLocation(true);
                    if (this.$refs.userDialogTabs.currentName === '0') {
                        this.userDialogLastActiveTab = $t(
                            'dialog.user.info.header'
                        );
                    } else if (this.$refs.userDialogTabs.currentName === '1') {
                        this.userDialogLastActiveTab = $t(
                            'dialog.user.groups.header'
                        );
                        if (this.userDialogLastGroup !== userId) {
                            this.userDialogLastGroup = userId;
                            this.getUserGroups(userId);
                        }
                    } else if (this.$refs.userDialogTabs.currentName === '2') {
                        this.userDialogLastActiveTab = $t(
                            'dialog.user.worlds.header'
                        );
                        this.setUserDialogWorlds(userId);
                        if (this.userDialogLastWorld !== userId) {
                            this.userDialogLastWorld = userId;
                            this.refreshUserDialogWorlds();
                        }
                    } else if (this.$refs.userDialogTabs.currentName === '3') {
                        this.userDialogLastActiveTab = $t(
                            'dialog.user.favorite_worlds.header'
                        );
                        if (this.userDialogLastFavoriteWorld !== userId) {
                            this.userDialogLastFavoriteWorld = userId;
                            this.getUserFavoriteWorlds(userId);
                        }
                    } else if (this.$refs.userDialogTabs.currentName === '4') {
                        this.userDialogLastActiveTab = $t(
                            'dialog.user.avatars.header'
                        );
                        this.setUserDialogAvatars(userId);
                        this.userDialogLastAvatar = userId;
                        if (
                            userId === API.currentUser.id &&
                            D.avatars.length === 0
                        ) {
                            this.refreshUserDialogAvatars();
                        }
                        this.setUserDialogAvatarsRemote(userId);
                    } else if (this.$refs.userDialogTabs.currentName === '5') {
                        this.userDialogLastActiveTab = $t(
                            'dialog.user.json.header'
                        );
                        this.refreshUserDialogTreeData();
                    }
                    if (args.cache) {
                        API.getUser(args.params);
                    }
                    var inCurrentWorld = false;
                    if (this.lastLocation.playerList.has(D.ref.displayName)) {
                        inCurrentWorld = true;
                    }
                    if (userId !== API.currentUser.id) {
                        database
                            .getUserStats(D.ref, inCurrentWorld)
                            .then((ref1) => {
                                if (ref1.userId === D.id) {
                                    D.lastSeen = ref1.created_at;
                                    D.joinCount = ref1.joinCount;
                                    D.timeSpent = ref1.timeSpent;
                                }
                                var displayNameMap = ref1.previousDisplayNames;
                                this.friendLogTable.data.forEach((ref2) => {
                                    if (ref2.userId === D.id) {
                                        if (ref2.type === 'DisplayName') {
                                            displayNameMap.set(
                                                ref2.previousDisplayName,
                                                ref2.created_at
                                            );
                                        }
                                        if (!D.dateFriended) {
                                            if (ref2.type === 'Unfriend') {
                                                D.unFriended = true;
                                                D.dateFriended =
                                                    ref2.created_at;
                                            }
                                            if (ref2.type === 'Friend') {
                                                D.unFriended = false;
                                                D.dateFriended =
                                                    ref2.created_at;
                                            }
                                        }
                                        if (
                                            ref2.type === 'Friend' ||
                                            ref2.type === 'Unfriend'
                                        ) {
                                            D.dateFriendedInfo.push(ref2);
                                        }
                                    }
                                });
                                var displayNameMapSorted = new Map(
                                    [...displayNameMap.entries()].sort(
                                        (a, b) => b[1] - a[1]
                                    )
                                );
                                D.previousDisplayNames = Array.from(
                                    displayNameMapSorted.keys()
                                );
                            });
                        AppApi.GetVRChatUserModeration(
                            API.currentUser.id,
                            userId
                        ).then((result) => {
                            D.avatarModeration = result;
                            if (result === 4) {
                                D.isHideAvatar = true;
                            } else if (result === 5) {
                                D.isShowAvatar = true;
                            }
                        });
                    }
                    API.getRepresentedGroup({ userId }).then((args1) => {
                        D.representedGroup = args1.json;
                        return args1;
                    });
                }
                return args;
            });
        this.showUserDialogHistory.delete(userId);
        this.showUserDialogHistory.add(userId);
    };

    $app.methods.applyUserDialogLocation = function (updateInstanceOccupants) {
        var D = this.userDialog;
        if (!D.visible) {
            return;
        }
        var L = API.parseLocation(D.ref.$location.tag);
        if (updateInstanceOccupants && this.isRealInstance(L.tag)) {
            API.getInstance({
                worldId: L.worldId,
                instanceId: L.instanceId
            });
        }
        D.$location = L;
        if (L.userId) {
            var ref = API.cachedUsers.get(L.userId);
            if (typeof ref === 'undefined') {
                API.getUser({
                    userId: L.userId
                }).then((args) => {
                    Vue.set(L, 'user', args.ref);
                    return args;
                });
            } else {
                L.user = ref;
            }
        }
        var users = [];
        var friendCount = 0;
        var playersInInstance = this.lastLocation.playerList;
        var cachedCurrentUser = API.cachedUsers.get(API.currentUser.id);
        var currentLocation = cachedCurrentUser.$location.tag;
        if (!L.isOffline && currentLocation === L.tag) {
            var ref = API.cachedUsers.get(API.currentUser.id);
            if (typeof ref !== 'undefined') {
                users.push(ref); // add self
            }
        }
        // dont use gamelog when using api location
        if (
            this.lastLocation.location === L.tag &&
            playersInInstance.size > 0
        ) {
            var friendsInInstance = this.lastLocation.friendList;
            for (var friend of friendsInInstance.values()) {
                // if friend isn't in instance add them
                var addUser = !users.some(function (user) {
                    return friend.displayName === user.displayName;
                });
                if (addUser) {
                    var ref = API.cachedUsers.get(friend.userId);
                    if (typeof ref !== 'undefined') {
                        users.push(ref);
                    }
                }
            }
            friendCount = users.length - 1;
        }
        if (!L.isOffline) {
            for (var friend of this.friends.values()) {
                if (typeof friend.ref === 'undefined') {
                    continue;
                }
                if (friend.ref.location === this.lastLocation.location) {
                    // don't add friends to currentUser gameLog instance (except when traveling)
                    continue;
                }
                if (friend.ref.$location.tag === L.tag) {
                    if (
                        friend.state !== 'online' &&
                        friend.ref.location === 'private'
                    ) {
                        // don't add offline friends to private instances
                        continue;
                    }
                    // if friend isn't in instance add them
                    var addUser = !users.some(function (user) {
                        return friend.name === user.displayName;
                    });
                    if (addUser) {
                        users.push(friend.ref);
                    }
                }
            }
            friendCount = users.length;
        }
        if (this.instanceUsersSortAlphabetical) {
            users.sort(compareByDisplayName);
        } else {
            users.sort(compareByLocationAt);
        }
        D.users = users;
        if (
            L.worldId &&
            currentLocation === L.tag &&
            playersInInstance.size > 0
        ) {
            D.instance = {
                id: L.instanceId,
                tag: L.tag,
                $location: L,
                friendCount: 0,
                users: [],
                shortName: '',
                ref: {}
            };
        }
        if (!this.isRealInstance(L.tag)) {
            D.instance = {
                id: L.instanceId,
                tag: L.tag,
                $location: L,
                friendCount: 0,
                users: [],
                shortName: '',
                ref: {}
            };
        }
        var instanceRef = API.cachedInstances.get(L.tag);
        if (typeof instanceRef !== 'undefined') {
            D.instance.ref = instanceRef;
        }
        D.instance.friendCount = friendCount;
        this.updateTimers();
    };

    // #endregion
    // #region | App: player list

    API.$on('LOGIN', function () {
        $app.currentInstanceUserList.data = [];
    });

    API.$on('USER:APPLY', function (ref) {
        // add user ref to playerList, friendList, photonLobby, photonLobbyCurrent
        if ($app.lastLocation.playerList.has(ref.displayName)) {
            var playerListRef = $app.lastLocation.playerList.get(
                ref.displayName
            );
            if (!playerListRef.userId) {
                playerListRef.userId = ref.id;
                $app.lastLocation.playerList.set(
                    ref.displayName,
                    playerListRef
                );
                if ($app.lastLocation.friendList.has(ref.displayName)) {
                    $app.lastLocation.friendList.set(
                        ref.displayName,
                        playerListRef
                    );
                }
            }
            // add/remove friends from lastLocation.friendList
            if (
                !$app.lastLocation.friendList.has(ref.displayName) &&
                $app.friends.has(ref.id)
            ) {
                var userMap = {
                    displayName: ref.displayName,
                    userId: ref.id,
                    joinTime: playerListRef.joinTime
                };
                $app.lastLocation.friendList.set(ref.displayName, userMap);
            }
            if (
                $app.lastLocation.friendList.has(ref.displayName) &&
                !$app.friends.has(ref.id)
            ) {
                $app.lastLocation.friendList.delete(ref.displayName);
            }
            $app.photonLobby.forEach((ref1, id) => {
                if (
                    typeof ref1 !== 'undefined' &&
                    ref1.displayName === ref.displayName &&
                    ref1 !== ref
                ) {
                    $app.photonLobby.set(id, ref);
                    if ($app.photonLobbyCurrent.has(id)) {
                        $app.photonLobbyCurrent.set(id, ref);
                    }
                }
            });
            $app.getCurrentInstanceUserList();
        }
    });

    $app.data.updatePlayerListTimer = null;
    $app.data.updatePlayerListPending = false;
    $app.methods.getCurrentInstanceUserList = function () {
        if (!this.friendLogInitStatus) {
            return;
        }
        if (this.updatePlayerListTimer) {
            this.updatePlayerListPending = true;
        } else {
            this.updatePlayerListExecute();
            this.updatePlayerListTimer = setTimeout(() => {
                if (this.updatePlayerListPending) {
                    this.updatePlayerListExecute();
                }
                this.updatePlayerListTimer = null;
            }, 150);
        }
    };

    $app.methods.updatePlayerListExecute = function () {
        try {
            this.updatePlayerListDebounce();
        } catch (err) {
            console.error(err);
        }
        this.updatePlayerListTimer = null;
        this.updatePlayerListPending = false;
    };

    $app.methods.updatePlayerListDebounce = function () {
        var users = [];
        var pushUser = function (ref) {
            var photonId = '';
            var isFriend = false;
            $app.photonLobbyCurrent.forEach((ref1, id) => {
                if (typeof ref1 !== 'undefined') {
                    if (
                        (typeof ref.id !== 'undefined' &&
                            typeof ref1.id !== 'undefined' &&
                            ref1.id === ref.id) ||
                        (typeof ref.displayName !== 'undefined' &&
                            typeof ref1.displayName !== 'undefined' &&
                            ref1.displayName === ref.displayName)
                    ) {
                        photonId = id;
                    }
                }
            });
            var isMaster = false;
            if (
                $app.photonLobbyMaster !== 0 &&
                photonId === $app.photonLobbyMaster
            ) {
                isMaster = true;
            }
            var isModerator = false;
            var lobbyJointime = $app.photonLobbyJointime.get(photonId);
            var inVRMode = null;
            var groupOnNameplate = '';
            if (typeof lobbyJointime !== 'undefined') {
                inVRMode = lobbyJointime.inVRMode;
                groupOnNameplate = lobbyJointime.groupOnNameplate;
                isModerator = lobbyJointime.canModerateInstance;
            }
            // if (groupOnNameplate) {
            //     API.getCachedGroup({
            //         groupId: groupOnNameplate
            //     }).then((args) => {
            //         groupOnNameplate = args.ref.name;
            //     });
            // }
            var timeoutTime = 0;
            if (typeof ref.id !== 'undefined') {
                isFriend = ref.isFriend;
                if (
                    $app.timeoutHudOverlayFilter === 'VIP' ||
                    $app.timeoutHudOverlayFilter === 'Friends'
                ) {
                    $app.photonLobbyTimeout.forEach((ref1) => {
                        if (ref1.userId === ref.id) {
                            timeoutTime = ref1.time;
                        }
                    });
                } else {
                    $app.photonLobbyTimeout.forEach((ref1) => {
                        if (ref1.displayName === ref.displayName) {
                            timeoutTime = ref1.time;
                        }
                    });
                }
            }
            users.push({
                ref,
                displayName: ref.displayName,
                timer: ref.$location_at,
                $trustSortNum: ref.$trustSortNum ?? 0,
                photonId,
                isMaster,
                isModerator,
                inVRMode,
                groupOnNameplate,
                isFriend,
                timeoutTime
            });
            // get block, mute
        };

        var playersInInstance = this.lastLocation.playerList;
        if (playersInInstance.size > 0) {
            var ref = API.cachedUsers.get(API.currentUser.id);
            if (
                typeof ref !== 'undefined' &&
                playersInInstance.has(ref.displayName)
            ) {
                pushUser(ref);
            }
            for (var player of playersInInstance.values()) {
                // if friend isn't in instance add them
                if (player.displayName === API.currentUser.displayName) {
                    continue;
                }
                var addUser = !users.some(function (user) {
                    return player.displayName === user.displayName;
                });
                if (addUser) {
                    var ref = API.cachedUsers.get(player.userId);
                    if (typeof ref !== 'undefined') {
                        pushUser(ref);
                    } else {
                        var { joinTime } = this.lastLocation.playerList.get(
                            player.displayName
                        );
                        if (!joinTime) {
                            joinTime = Date.now();
                        }
                        var ref = {
                            // if userId is missing just push displayName
                            displayName: player.displayName,
                            $location_at: joinTime,
                            $online_for: joinTime
                        };
                        pushUser(ref);
                    }
                }
            }
        }
        this.currentInstanceUserList.data = users;
        this.updateTimers();
    };

    $app.data.updateInstanceInfo = 0;

    $app.data.currentInstanceWorld = {
        ref: {},
        instance: {},
        isPC: false,
        isQuest: false,
        isIos: false,
        avatarScalingDisabled: false,
        inCache: false,
        cacheSize: '',
        fileCreatedAt: '',
        fileSize: ''
    };
    $app.data.currentInstanceLocation = {};

    $app.methods.updateCurrentInstanceWorld = function () {
        var instanceId = this.lastLocation.location;
        if (this.lastLocation.location === 'traveling') {
            instanceId = this.lastLocationDestination;
        }
        if (!instanceId) {
            this.currentInstanceWorld = {
                ref: {},
                instance: {},
                isPC: false,
                isQuest: false,
                isIos: false,
                avatarScalingDisabled: false,
                inCache: false,
                cacheSize: '',
                fileCreatedAt: '',
                fileSize: ''
            };
            this.currentInstanceLocation = {};
        } else if (instanceId !== this.currentInstanceLocation.tag) {
            this.currentInstanceWorld = {
                ref: {},
                instance: {},
                isPC: false,
                isQuest: false,
                isIos: false,
                avatarScalingDisabled: false,
                inCache: false,
                cacheSize: '',
                fileCreatedAt: '',
                fileSize: ''
            };
            var L = API.parseLocation(instanceId);
            this.currentInstanceLocation = L;
            API.getWorld({
                worldId: L.worldId
            }).then((args) => {
                this.currentInstanceWorld.ref = args.ref;
                var { isPC, isQuest, isIos } = this.getAvailablePlatforms(
                    args.ref.unityPackages
                );
                this.currentInstanceWorld.isPC = isPC;
                this.currentInstanceWorld.isQuest = isQuest;
                this.currentInstanceWorld.isIos = isIos;
                this.currentInstanceWorld.avatarScalingDisabled =
                    args.ref?.tags.includes('feature_avatar_scaling_disabled');
                this.checkVRChatCache(args.ref).then((cacheInfo) => {
                    if (cacheInfo.Item1 > 0) {
                        this.currentInstanceWorld.inCache = true;
                        this.currentInstanceWorld.cacheSize = `${(
                            cacheInfo.Item1 / 1048576
                        ).toFixed(2)} MB`;
                    }
                });
                this.getBundleDateSize(args.ref).then(
                    ({ createdAt, fileSize }) => {
                        this.currentInstanceWorld.fileCreatedAt = createdAt;
                        this.currentInstanceWorld.fileSize = fileSize;
                    }
                );
                return args;
            });
        } else {
            API.getCachedWorld({
                worldId: this.currentInstanceLocation.worldId
            }).then((args) => {
                this.currentInstanceWorld.ref = args.ref;
                var { isPC, isQuest, isIos } = this.getAvailablePlatforms(
                    args.ref.unityPackages
                );
                this.currentInstanceWorld.isPC = isPC;
                this.currentInstanceWorld.isQuest = isQuest;
                this.currentInstanceWorld.isIos = isIos;
                this.checkVRChatCache(args.ref).then((cacheInfo) => {
                    if (cacheInfo.Item1 > 0) {
                        this.currentInstanceWorld.inCache = true;
                        this.currentInstanceWorld.cacheSize = `${(
                            cacheInfo.Item1 / 1048576
                        ).toFixed(2)} MB`;
                    }
                });
            });
        }
        if (this.isRealInstance(instanceId)) {
            var ref = API.cachedInstances.get(instanceId);
            if (typeof ref !== 'undefined') {
                this.currentInstanceWorld.instance = ref;
            } else {
                var L = API.parseLocation(instanceId);
                API.getInstance({
                    worldId: L.worldId,
                    instanceId: L.instanceId
                }).then((args) => {
                    this.currentInstanceWorld.instance = args.ref;
                });
            }
        }
    };

    $app.methods.getAvailablePlatforms = function (unityPackages) {
        var isPC = false;
        var isQuest = false;
        var isIos = false;
        if (typeof unityPackages === 'object') {
            for (var unityPackage of unityPackages) {
                if (
                    unityPackage.variant &&
                    unityPackage.variant !== 'standard'
                ) {
                    continue;
                }
                if (unityPackage.platform === 'standalonewindows') {
                    isPC = true;
                } else if (unityPackage.platform === 'android') {
                    isQuest = true;
                } else if (unityPackage.platform === 'ios') {
                    isIos = true;
                }
            }
        }
        return { isPC, isQuest, isIos };
    };

    $app.methods.selectCurrentInstanceRow = function (val) {
        if (val === null) {
            return;
        }
        var ref = val.ref;
        if (ref.id) {
            this.showUserDialog(ref.id);
        } else {
            this.lookupUser(ref);
        }
    };

    $app.methods.updateTimers = function () {
        for (var $timer of $timers) {
            $timer.update();
        }
    };

    $app.methods.setUserDialogWorlds = function (userId) {
        var worlds = [];
        for (var ref of API.cachedWorlds.values()) {
            if (ref.authorId === userId) {
                worlds.push(ref);
            }
        }
        $app.userDialog.worlds = worlds;
    };

    $app.methods.setUserDialogAvatars = function (userId) {
        var avatars = new Set();
        this.userDialogAvatars.forEach((avatar) => {
            avatars.add(avatar.id, avatar);
        });
        for (var ref of API.cachedAvatars.values()) {
            if (ref.authorId === userId && !avatars.has(ref.id)) {
                this.userDialog.avatars.push(ref);
            }
        }
        this.sortUserDialogAvatars(this.userDialog.avatars);
    };

    $app.methods.setUserDialogAvatarsRemote = async function (userId) {
        if (this.avatarRemoteDatabase && userId !== API.currentUser.id) {
            var data = await this.lookupAvatars('authorId', userId);
            var avatars = new Set();
            this.userDialogAvatars.forEach((avatar) => {
                avatars.add(avatar.id, avatar);
            });
            if (data && typeof data === 'object') {
                data.forEach((avatar) => {
                    if (avatar.id && !avatars.has(avatar.id)) {
                        this.userDialog.avatars.push(avatar);
                    }
                });
            }
            this.userDialog.avatarSorting = 'name';
            this.userDialog.avatarReleaseStatus = 'all';
        }
        this.sortUserDialogAvatars(this.userDialog.avatars);
    };

    $app.methods.lookupAvatars = async function (type, search) {
        var avatars = new Map();
        if (type === 'search') {
            try {
                var response = await webApiService.execute({
                    url: `${
                        this.avatarRemoteDatabaseProvider
                    }?${type}=${encodeURIComponent(search)}&n=5000`,
                    method: 'GET',
                    headers: {
                        Referer: 'https://vrcx.pypy.moe'
                    }
                });
                var json = JSON.parse(response.data);
                if (this.debugWebRequests) {
                    console.log(json, response);
                }
                if (response.status === 200 && typeof json === 'object') {
                    json.forEach((avatar) => {
                        if (!avatars.has(avatar.Id)) {
                            var ref = {
                                authorId: '',
                                authorName: '',
                                name: '',
                                description: '',
                                id: '',
                                imageUrl: '',
                                thumbnailImageUrl: '',
                                created_at: '0001-01-01T00:00:00.0000000Z',
                                updated_at: '0001-01-01T00:00:00.0000000Z',
                                releaseStatus: 'public',
                                ...avatar
                            };
                            avatars.set(ref.id, ref);
                        }
                    });
                } else {
                    throw new Error(`Error: ${response.data}`);
                }
            } catch (err) {
                var msg = `Avatar search failed for ${search} with ${this.avatarRemoteDatabaseProvider}\n${err}`;
                console.error(msg);
                this.$message({
                    message: msg,
                    type: 'error'
                });
            }
        } else if (type === 'authorId') {
            var length = this.avatarRemoteDatabaseProviderList.length;
            for (var i = 0; i < length; ++i) {
                var url = this.avatarRemoteDatabaseProviderList[i];
                var avatarArray = await this.lookupAvatarsByAuthor(url, search);
                avatarArray.forEach((avatar) => {
                    if (!avatars.has(avatar.id)) {
                        avatars.set(avatar.id, avatar);
                    }
                });
            }
        }
        return avatars;
    };

    $app.methods.lookupAvatarsByAuthor = async function (url, authorId) {
        var avatars = [];
        if (!url) {
            return avatars;
        }
        try {
            var response = await webApiService.execute({
                url: `${url}?authorId=${encodeURIComponent(authorId)}`,
                method: 'GET',
                headers: {
                    Referer: 'https://vrcx.pypy.moe'
                }
            });
            var json = JSON.parse(response.data);
            if (this.debugWebRequests) {
                console.log(json, response);
            }
            if (response.status === 200 && typeof json === 'object') {
                json.forEach((avatar) => {
                    var ref = {
                        authorId: '',
                        authorName: '',
                        name: '',
                        description: '',
                        id: '',
                        imageUrl: '',
                        thumbnailImageUrl: '',
                        created_at: '0001-01-01T00:00:00.0000000Z',
                        updated_at: '0001-01-01T00:00:00.0000000Z',
                        releaseStatus: 'public',
                        ...avatar
                    };
                    avatars.push(ref);
                });
            } else {
                throw new Error(`Error: ${response.data}`);
            }
        } catch (err) {
            var msg = `Avatar lookup failed for ${authorId} with ${url}\n${err}`;
            console.error(msg);
            this.$message({
                message: msg,
                type: 'error'
            });
        }
        return avatars;
    };

    $app.methods.sortUserDialogAvatars = function (array) {
        var D = this.userDialog;
        if (D.avatarSorting === 'update') {
            array.sort(compareByUpdatedAt);
        } else {
            array.sort(compareByName);
        }
        D.avatars = array;
    };

    $app.methods.refreshUserDialogWorlds = function () {
        var D = this.userDialog;
        if (D.isWorldsLoading) {
            return;
        }
        D.isWorldsLoading = true;
        var params = {
            n: 50,
            offset: 0,
            sort: this.userDialog.worldSorting.value,
            order: this.userDialog.worldOrder.value,
            // user: 'friends',
            userId: D.id,
            releaseStatus: 'public'
        };
        if (params.userId === API.currentUser.id) {
            params.user = 'me';
            params.releaseStatus = 'all';
        }
        var map = new Map();
        for (var ref of API.cachedWorlds.values()) {
            if (
                ref.authorId === D.id &&
                (ref.authorId === API.currentUser.id ||
                    ref.releaseStatus === 'public')
            ) {
                API.cachedWorlds.delete(ref.id);
            }
        }
        API.bulk({
            fn: 'getWorlds',
            N: -1,
            params,
            handle: (args) => {
                for (var json of args.json) {
                    var $ref = API.cachedWorlds.get(json.id);
                    if (typeof $ref !== 'undefined') {
                        map.set($ref.id, $ref);
                    }
                }
            },
            done: () => {
                if (D.id === params.userId) {
                    var array = Array.from(map.values());
                    $app.userDialog.worlds = array;
                }
                D.isWorldsLoading = false;
            }
        });
    };

    $app.methods.refreshUserDialogAvatars = function (fileId) {
        var D = this.userDialog;
        if (D.isAvatarsLoading) {
            return;
        }
        D.isAvatarsLoading = true;
        if (fileId) {
            D.loading = true;
        }
        var params = {
            n: 50,
            offset: 0,
            sort: 'updated',
            order: 'descending',
            releaseStatus: 'all',
            user: 'me'
        };
        for (let ref of API.cachedAvatars.values()) {
            if (ref.authorId === D.id) {
                API.cachedAvatars.delete(ref.id);
            }
        }
        var map = new Map();
        API.bulk({
            fn: 'getAvatars',
            N: -1,
            params,
            handle: (args) => {
                for (var json of args.json) {
                    var $ref = API.cachedAvatars.get(json.id);
                    if (typeof $ref !== 'undefined') {
                        map.set($ref.id, $ref);
                    }
                }
            },
            done: () => {
                var array = Array.from(map.values());
                this.sortUserDialogAvatars(array);
                D.isAvatarsLoading = false;
                if (fileId) {
                    D.loading = false;
                    for (let ref of array) {
                        if (extractFileId(ref.imageUrl) === fileId) {
                            this.showAvatarDialog(ref.id);
                            return;
                        }
                    }
                    this.$message({
                        message: 'Own avatar not found',
                        type: 'error'
                    });
                }
            }
        });
    };

    var performUserDialogCommand = (command, userId) => {
        switch (command) {
            case 'Delete Favorite':
                API.deleteFavorite({
                    objectId: userId
                });
                break;
            case 'Accept Friend Request':
                var key = API.getFriendRequest(userId);
                if (key === '') {
                    API.sendFriendRequest({
                        userId
                    });
                } else {
                    API.acceptNotification({
                        notificationId: key
                    });
                }
                break;
            case 'Decline Friend Request':
                var key = API.getFriendRequest(userId);
                if (key === '') {
                    API.cancelFriendRequest({
                        userId
                    });
                } else {
                    API.hideNotification({
                        notificationId: key
                    });
                }
                break;
            case 'Cancel Friend Request':
                API.cancelFriendRequest({
                    userId
                });
                break;
            case 'Send Friend Request':
                API.sendFriendRequest({
                    userId
                });
                break;
            case 'Unblock':
                API.deletePlayerModeration({
                    moderated: userId,
                    type: 'block'
                });
                break;
            case 'Block':
                API.sendPlayerModeration({
                    moderated: userId,
                    type: 'block'
                });
                break;
            case 'Unmute':
                API.deletePlayerModeration({
                    moderated: userId,
                    type: 'mute'
                });
                break;
            case 'Mute':
                API.sendPlayerModeration({
                    moderated: userId,
                    type: 'mute'
                });
                break;
            case 'Enable Avatar Interaction':
                API.deletePlayerModeration({
                    moderated: userId,
                    type: 'interactOff'
                });
                break;
            case 'Disable Avatar Interaction':
                API.sendPlayerModeration({
                    moderated: userId,
                    type: 'interactOff'
                });
                break;
            case 'Report Hacking':
                $app.reportUserForHacking(userId);
                break;
            case 'Unfriend':
                API.deleteFriend({
                    userId
                });
                break;
        }
    };

    $app.methods.userDialogCommand = function (command) {
        var D = this.userDialog;
        if (D.visible === false) {
            return;
        }
        if (command === 'Refresh') {
            this.showUserDialog(D.id);
        } else if (command === 'Add Favorite') {
            this.showFavoriteDialog('friend', D.id);
        } else if (command === 'Edit Social Status') {
            this.showSocialStatusDialog();
        } else if (command === 'Edit Language') {
            this.showLanguageDialog();
        } else if (command === 'Edit Bio') {
            this.showBioDialog();
        } else if (command === 'Logout') {
            this.logout();
        } else if (command === 'Request Invite') {
            API.sendRequestInvite(
                {
                    platform: 'standalonewindows'
                },
                D.id
            ).then((args) => {
                this.$message('Request invite sent');
                return args;
            });
        } else if (command === 'Invite Message') {
            var L = API.parseLocation(this.lastLocation.location);
            API.getCachedWorld({
                worldId: L.worldId
            }).then((args) => {
                this.showSendInviteDialog(
                    {
                        instanceId: this.lastLocation.location,
                        worldId: this.lastLocation.location,
                        worldName: args.ref.name
                    },
                    D.id
                );
            });
        } else if (command === 'Request Invite Message') {
            this.showSendInviteRequestDialog(
                {
                    platform: 'standalonewindows'
                },
                D.id
            );
        } else if (command === 'Invite') {
            var currentLocation = this.lastLocation.location;
            if (this.lastLocation.location === 'traveling') {
                currentLocation = this.lastLocationDestination;
            }
            var L = API.parseLocation(currentLocation);
            API.getCachedWorld({
                worldId: L.worldId
            }).then((args) => {
                API.sendInvite(
                    {
                        instanceId: L.tag,
                        worldId: L.tag,
                        worldName: args.ref.name
                    },
                    D.id
                ).then((_args) => {
                    this.$message('Invite sent');
                    return _args;
                });
            });
        } else if (command === 'Show Avatar Author') {
            var { currentAvatarImageUrl } = D.ref;
            this.showAvatarAuthorDialog(
                D.id,
                D.$avatarInfo.ownerId,
                currentAvatarImageUrl
            );
        } else if (command === 'Show Fallback Avatar Details') {
            var { fallbackAvatar } = D.ref;
            if (fallbackAvatar) {
                this.showAvatarDialog(fallbackAvatar);
            } else {
                this.$message({
                    message: 'No fallback avatar set',
                    type: 'error'
                });
            }
        } else if (command === 'Previous Images') {
            this.displayPreviousImages('User', 'Display');
        } else if (command === 'Previous Instances') {
            this.showPreviousInstancesUserDialog(D.ref);
        } else if (command === 'Manage Gallery') {
            this.showGalleryDialog();
        } else if (command === 'Invite To Group') {
            this.showInviteGroupDialog('', D.id);
        } else if (command === 'Hide Avatar') {
            if (D.isHideAvatar) {
                this.setPlayerModeration(D.id, 0);
            } else {
                this.setPlayerModeration(D.id, 4);
            }
        } else if (command === 'Show Avatar') {
            if (D.isShowAvatar) {
                this.setPlayerModeration(D.id, 0);
            } else {
                this.setPlayerModeration(D.id, 5);
            }
        } else {
            this.$confirm(`Continue? ${command}`, 'Confirm', {
                confirmButtonText: 'Confirm',
                cancelButtonText: 'Cancel',
                type: 'info',
                callback: (action) => {
                    if (action === 'confirm') {
                        performUserDialogCommand(command, D.id);
                    }
                }
            });
        }
    };

    $app.methods.refreshUserDialogTreeData = function () {
        var D = this.userDialog;
        if (D.id === API.currentUser.id) {
            var treeData = {
                ...API.currentUser,
                ...D.ref
            };
            D.treeData = buildTreeData(treeData);
            return;
        }
        D.treeData = buildTreeData(D.ref);
    };

    $app.methods.changeUserDialogAvatarSorting = function () {
        var D = this.userDialog;
        this.sortUserDialogAvatars(D.avatars);
    };

    $app.computed.userDialogAvatars = function () {
        var { avatars, avatarReleaseStatus } = this.userDialog;
        if (
            avatarReleaseStatus === 'public' ||
            avatarReleaseStatus === 'private'
        ) {
            return avatars.filter(
                (avatar) => avatar.releaseStatus === avatarReleaseStatus
            );
        }
        return avatars;
    };

    // #endregion
    // #region | App: World Dialog

    $app.data.worldDialog = {
        visible: false,
        loading: false,
        id: '',
        memo: '',
        $location: {},
        ref: {},
        isFavorite: false,
        avatarScalingDisabled: false,
        rooms: [],
        treeData: [],
        fileCreatedAt: '',
        fileSize: '',
        inCache: false,
        cacheSize: 0,
        cacheLocked: false,
        cachePath: '',
        lastVisit: '',
        visitCount: 0,
        timeSpent: 0,
        isPC: false,
        isQuest: false,
        isIos: false
    };

    $app.data.ignoreWorldMemoSave = false;

    $app.watch['worldDialog.memo'] = function () {
        if (this.ignoreWorldMemoSave) {
            this.ignoreWorldMemoSave = false;
            return;
        }
        var D = this.worldDialog;
        this.saveWorldMemo(D.id, D.memo);
    };

    API.$on('LOGOUT', function () {
        $app.worldDialog.visible = false;
    });

    API.$on('WORLD', function (args) {
        var { ref } = args;
        var D = $app.worldDialog;
        if (D.visible === false || D.id !== ref.id) {
            return;
        }
        D.ref = ref;
        D.avatarScalingDisabled = ref.tags?.includes(
            'feature_avatar_scaling_disabled'
        );
        $app.applyWorldDialogInstances();
        for (var room of D.rooms) {
            if ($app.isRealInstance(room.tag)) {
                API.getInstance({
                    worldId: D.id,
                    instanceId: room.id
                });
            }
        }
        if (D.fileSize === 'Loading') {
            $app.getBundleDateSize(ref)
                .then(({ createdAt, fileSize }) => {
                    D.fileCreatedAt = createdAt;
                    if (fileSize) {
                        D.fileSize = fileSize;
                    } else {
                        D.fileSize = 'Error';
                    }
                })
                .catch(() => {
                    D.fileSize = 'Error';
                });
        }
    });

    $app.methods.getBundleDateSize = async function (ref) {
        var assetUrl = '';
        var createdAt = '';
        var fileSize = '';
        for (let i = ref.unityPackages.length - 1; i > -1; i--) {
            var unityPackage = ref.unityPackages[i];
            if (unityPackage.variant && unityPackage.variant !== 'standard') {
                continue;
            }
            if (
                unityPackage.platform === 'standalonewindows' &&
                this.compareUnityVersion(unityPackage.unityVersion)
            ) {
                assetUrl = unityPackage.assetUrl;
                break;
            }
        }
        var fileId = extractFileId(assetUrl);
        var fileVersion = parseInt(extractFileVersion(assetUrl), 10);
        if (fileId) {
            var args = await API.getBundles(fileId);
            if (
                typeof args.json !== 'undefined' &&
                typeof args.json.versions !== 'undefined'
            ) {
                var { versions } = args.json;
                for (let i = versions.length - 1; i > -1; i--) {
                    var version = versions[i];
                    if (version.version === fileVersion) {
                        createdAt = version.created_at;
                        fileSize = `${(
                            version.file.sizeInBytes / 1048576
                        ).toFixed(2)} MB`;
                        break;
                    }
                }
            }
        }
        return { createdAt, fileSize };
    };

    API.$on('FAVORITE', function (args) {
        var { ref } = args;
        var D = $app.worldDialog;
        if (D.visible === false || ref.$isDeleted || ref.favoriteId !== D.id) {
            return;
        }
        D.isFavorite = true;
    });

    API.$on('FAVORITE:@DELETE', function (args) {
        var D = $app.worldDialog;
        if (D.visible === false || D.id !== args.ref.favoriteId) {
            return;
        }
        D.isFavorite = $app.localWorldFavoritesList.includes(D.id);
    });

    $app.methods.showWorldDialog = function (tag, shortName) {
        this.$nextTick(() => adjustDialogZ(this.$refs.worldDialog.$el));
        var D = this.worldDialog;
        var L = API.parseLocation(tag);
        if (L.worldId === '') {
            return;
        }
        L.shortName = shortName;
        D.id = L.worldId;
        D.$location = L;
        D.treeData = [];
        D.fileCreatedAt = '';
        D.fileSize = 'Loading';
        D.visible = true;
        D.loading = true;
        D.inCache = false;
        D.cacheSize = 0;
        D.cacheLocked = false;
        D.rooms = [];
        D.lastVisit = '';
        D.visitCount = '';
        D.timeSpent = 0;
        D.isFavorite = false;
        D.avatarScalingDisabled = false;
        D.isPC = false;
        D.isQuest = false;
        D.isIos = false;
        this.ignoreWorldMemoSave = true;
        D.memo = '';
        var LL = API.parseLocation(this.lastLocation.location);
        var currentWorldMatch = false;
        if (LL.worldId === D.id) {
            currentWorldMatch = true;
        }
        this.getWorldMemo(D.id).then((memo) => {
            if (memo.worldId === D.id) {
                this.ignoreWorldMemoSave = true;
                D.memo = memo.memo;
            }
        });
        database.getLastVisit(D.id, currentWorldMatch).then((ref) => {
            if (ref.worldId === D.id) {
                D.lastVisit = ref.created_at;
            }
        });
        database.getVisitCount(D.id).then((ref) => {
            if (ref.worldId === D.id) {
                D.visitCount = ref.visitCount;
            }
        });
        database.getTimeSpentInWorld(D.id).then((ref) => {
            if (ref.worldId === D.id) {
                D.timeSpent = ref.timeSpent;
            }
        });
        API.getCachedWorld({
            worldId: L.worldId
        })
            .catch((err) => {
                D.loading = false;
                D.visible = false;
                this.$message({
                    message: 'Failed to load world',
                    type: 'error'
                });
                throw err;
            })
            .then((args) => {
                if (D.id === args.ref.id) {
                    D.loading = false;
                    D.ref = args.ref;
                    D.isFavorite = API.cachedFavoritesByObjectId.has(D.id);
                    if (!D.isFavorite) {
                        D.isFavorite = this.localWorldFavoritesList.includes(
                            D.id
                        );
                    }
                    var { isPC, isQuest, isIos } = this.getAvailablePlatforms(
                        args.ref.unityPackages
                    );
                    D.avatarScalingDisabled = args.ref?.tags.includes(
                        'feature_avatar_scaling_disabled'
                    );
                    D.isPC = isPC;
                    D.isQuest = isQuest;
                    D.isIos = isIos;
                    this.updateVRChatWorldCache();
                    if (args.cache) {
                        API.getWorld(args.params)
                            .catch((err) => {
                                throw err;
                            })
                            .then((args1) => {
                                if (D.id === args1.ref.id) {
                                    D.ref = args1.ref;
                                    this.updateVRChatWorldCache();
                                }
                                return args1;
                            });
                    }
                }
                return args;
            });
    };

    $app.methods.applyWorldDialogInstances = function () {
        var D = this.worldDialog;
        if (!D.visible) {
            return;
        }
        var instances = {};
        if (D.ref.instances) {
            for (var instance of D.ref.instances) {
                // instance = [ instanceId, occupants ]
                var instanceId = instance[0];
                instances[instanceId] = {
                    id: instanceId,
                    tag: `${D.id}:${instanceId}`,
                    $location: {},
                    friendCount: 0,
                    users: [],
                    shortName: '',
                    ref: {}
                };
            }
        }
        var { instanceId, shortName } = D.$location;
        if (instanceId && typeof instances[instanceId] === 'undefined') {
            instances[instanceId] = {
                id: instanceId,
                tag: `${D.id}:${instanceId}`,
                $location: {},
                friendCount: 0,
                users: [],
                shortName,
                ref: {}
            };
        }
        var cachedCurrentUser = API.cachedUsers.get(API.currentUser.id);
        var lastLocation$ = cachedCurrentUser.$location;
        var playersInInstance = this.lastLocation.playerList;
        if (lastLocation$.worldId === D.id && playersInInstance.size > 0) {
            // pull instance json from cache
            var friendsInInstance = this.lastLocation.friendList;
            var instance = {
                id: lastLocation$.instanceId,
                tag: lastLocation$.tag,
                $location: {},
                friendCount: friendsInInstance.size,
                users: [],
                shortName: '',
                ref: {}
            };
            instances[instance.id] = instance;
            for (var friend of friendsInInstance.values()) {
                // if friend isn't in instance add them
                var addUser = !instance.users.some(function (user) {
                    return friend.displayName === user.displayName;
                });
                if (addUser) {
                    var ref = API.cachedUsers.get(friend.userId);
                    if (typeof ref !== 'undefined') {
                        instance.users.push(ref);
                    }
                }
            }
        }
        for (var { ref } of this.friends.values()) {
            if (
                typeof ref === 'undefined' ||
                typeof ref.$location === 'undefined' ||
                ref.$location.worldId !== D.id ||
                (ref.$location.instanceId === lastLocation$.instanceId &&
                    playersInInstance.size > 0 &&
                    ref.location !== 'traveling')
            ) {
                continue;
            }
            if (ref.location === this.lastLocation.location) {
                // don't add friends to currentUser gameLog instance (except when traveling)
                continue;
            }
            var { instanceId } = ref.$location;
            var instance = instances[instanceId];
            if (typeof instance === 'undefined') {
                instance = {
                    id: instanceId,
                    tag: `${D.id}:${instanceId}`,
                    $location: {},
                    friendCount: 0,
                    users: [],
                    shortName: '',
                    ref: {}
                };
                instances[instanceId] = instance;
            }
            instance.users.push(ref);
        }
        var ref = API.cachedUsers.get(API.currentUser.id);
        if (typeof ref !== 'undefined' && ref.$location.worldId === D.id) {
            var { instanceId } = ref.$location;
            var instance = instances[instanceId];
            if (typeof instance === 'undefined') {
                instance = {
                    id: instanceId,
                    tag: `${D.id}:${instanceId}`,
                    $location: {},
                    friendCount: 0,
                    users: [],
                    shortName: '',
                    ref: {}
                };
                instances[instanceId] = instance;
            }
            instance.users.push(ref); // add self
        }
        var rooms = [];
        for (var instance of Object.values(instances)) {
            // due to references on callback of API.getUser()
            // this should be block scope variable
            const L = API.parseLocation(`${D.id}:${instance.id}`);
            instance.location = L.tag;
            if (!L.shortName) {
                L.shortName = instance.shortName;
            }
            instance.$location = L;
            if (L.userId) {
                var ref = API.cachedUsers.get(L.userId);
                if (typeof ref === 'undefined') {
                    API.getUser({
                        userId: L.userId
                    }).then((args) => {
                        Vue.set(L, 'user', args.ref);
                        return args;
                    });
                } else {
                    L.user = ref;
                }
            }
            if (instance.friendCount === 0) {
                instance.friendCount = instance.users.length;
            }
            if (this.instanceUsersSortAlphabetical) {
                instance.users.sort(compareByDisplayName);
            } else {
                instance.users.sort(compareByLocationAt);
            }
            rooms.push(instance);
        }
        // get instance from cache
        for (var room of rooms) {
            var ref = API.cachedInstances.get(room.tag);
            if (typeof ref !== 'undefined') {
                room.ref = ref;
            }
        }
        rooms.sort(function (a, b) {
            // sort selected and current instance to top
            if (
                b.location === D.$location.tag ||
                b.location === lastLocation$.tag
            ) {
                // sort selected instance above current instance
                if (a.location === D.$location.tag) {
                    return -1;
                }
                return 1;
            }
            if (
                a.location === D.$location.tag ||
                a.location === lastLocation$.tag
            ) {
                // sort selected instance above current instance
                if (b.location === D.$location.tag) {
                    return 1;
                }
                return -1;
            }
            // sort by number of users when no friends in instance
            if (a.users.length === 0 && b.users.length === 0) {
                if (a.ref?.n_users < b.ref?.n_users) {
                    return 1;
                }
                return -1;
            }
            // sort by number of friends in instance
            if (a.users.length < b.users.length) {
                return 1;
            }
            return -1;
        });
        D.rooms = rooms;
        this.updateTimers();
    };

    $app.methods.applyGroupDialogInstances = function (inputInstances) {
        var D = this.groupDialog;
        if (!D.visible) {
            return;
        }
        var instances = {};
        for (var instance of D.instances) {
            instances[instance.tag] = {
                ...instance,
                friendCount: 0,
                users: []
            };
        }
        if (typeof inputInstances !== 'undefined') {
            for (var instance of inputInstances) {
                instances[instance.location] = {
                    id: instance.instanceId,
                    tag: instance.location,
                    $location: {},
                    friendCount: 0,
                    users: [],
                    shortName: instance.shortName,
                    ref: instance
                };
            }
        }
        var cachedCurrentUser = API.cachedUsers.get(API.currentUser.id);
        var lastLocation$ = cachedCurrentUser.$location;
        var currentLocation = lastLocation$.tag;
        var playersInInstance = this.lastLocation.playerList;
        if (lastLocation$.groupId === D.id && playersInInstance.size > 0) {
            var friendsInInstance = this.lastLocation.friendList;
            var instance = {
                id: lastLocation$.instanceId,
                tag: currentLocation,
                $location: {},
                friendCount: friendsInInstance.size,
                users: [],
                shortName: '',
                ref: {}
            };
            instances[currentLocation] = instance;
            for (var friend of friendsInInstance.values()) {
                // if friend isn't in instance add them
                var addUser = !instance.users.some(function (user) {
                    return friend.displayName === user.displayName;
                });
                if (addUser) {
                    var ref = API.cachedUsers.get(friend.userId);
                    if (typeof ref !== 'undefined') {
                        instance.users.push(ref);
                    }
                }
            }
        }
        for (var { ref } of this.friends.values()) {
            if (
                typeof ref === 'undefined' ||
                typeof ref.$location === 'undefined' ||
                ref.$location.groupId !== D.id ||
                (ref.$location.instanceId === lastLocation$.instanceId &&
                    playersInInstance.size > 0 &&
                    ref.location !== 'traveling')
            ) {
                continue;
            }
            if (ref.location === this.lastLocation.location) {
                // don't add friends to currentUser gameLog instance (except when traveling)
                continue;
            }
            var { instanceId, tag } = ref.$location;
            var instance = instances[tag];
            if (typeof instance === 'undefined') {
                instance = {
                    id: instanceId,
                    tag,
                    $location: {},
                    friendCount: 0,
                    users: [],
                    shortName: '',
                    ref: {}
                };
                instances[tag] = instance;
            }
            instance.users.push(ref);
        }
        var ref = API.cachedUsers.get(API.currentUser.id);
        if (typeof ref !== 'undefined' && ref.$location.groupId === D.id) {
            var { instanceId, tag } = ref.$location;
            var instance = instances[tag];
            if (typeof instance === 'undefined') {
                instance = {
                    id: instanceId,
                    tag,
                    $location: {},
                    friendCount: 0,
                    users: [],
                    shortName: '',
                    ref: {}
                };
                instances[tag] = instance;
            }
            instance.users.push(ref); // add self
        }
        var rooms = [];
        for (var instance of Object.values(instances)) {
            // due to references on callback of API.getUser()
            // this should be block scope variable
            const L = API.parseLocation(instance.tag);
            instance.location = instance.tag;
            instance.$location = L;
            if (instance.friendCount === 0) {
                instance.friendCount = instance.users.length;
            }
            if (this.instanceUsersSortAlphabetical) {
                instance.users.sort(compareByDisplayName);
            } else {
                instance.users.sort(compareByLocationAt);
            }
            rooms.push(instance);
        }
        // get instance
        for (var room of rooms) {
            var ref = API.cachedInstances.get(room.tag);
            if (typeof ref !== 'undefined') {
                room.ref = ref;
            } else if ($app.isRealInstance(room.tag)) {
                API.getInstance({
                    worldId: room.$location.worldId,
                    instanceId: room.$location.instanceId
                });
            }
        }
        rooms.sort(function (a, b) {
            // sort current instance to top
            if (b.location === currentLocation) {
                return 1;
            }
            if (a.location === currentLocation) {
                return -1;
            }
            // sort by number of users when no friends in instance
            if (a.users.length === 0 && b.users.length === 0) {
                if (a.ref?.n_users < b.ref?.n_users) {
                    return 1;
                }
                return -1;
            }
            // sort by number of friends in instance
            if (a.users.length < b.users.length) {
                return 1;
            }
            return -1;
        });
        D.instances = rooms;
        this.updateTimers();
    };

    $app.methods.worldDialogCommand = function (command) {
        var D = this.worldDialog;
        if (D.visible === false) {
            return;
        }
        switch (command) {
            case 'Refresh':
                this.showWorldDialog(D.id);
                break;
            case 'New Instance':
                this.showNewInstanceDialog(D.$location.tag);
                break;
            case 'Add Favorite':
                this.showFavoriteDialog('world', D.id);
                break;
            case 'Rename':
                this.promptRenameWorld(D);
                break;
            case 'Change Image':
                this.displayPreviousImages('World', 'Change');
                break;
            case 'Previous Images':
                this.displayPreviousImages('World', 'Display');
                break;
            case 'Previous Instances':
                this.showPreviousInstancesWorldDialog(D.ref);
                break;
            case 'Change Description':
                this.promptChangeWorldDescription(D);
                break;
            case 'Change Capacity':
                this.promptChangeWorldCapacity(D);
                break;
            case 'Change Recommended Capacity':
                this.promptChangeWorldRecommendedCapacity(D);
                break;
            case 'Change YouTube Preview':
                this.promptChangeWorldYouTubePreview(D);
                break;
            case 'Change Tags':
                this.showSetWorldTagsDialog();
                break;
            case 'Download Unity Package':
                this.openExternalLink(this.worldDialog.ref.unityPackageUrl);
                break;
            default:
                this.$confirm(`Continue? ${command}`, 'Confirm', {
                    confirmButtonText: 'Confirm',
                    cancelButtonText: 'Cancel',
                    type: 'info',
                    callback: (action) => {
                        if (action !== 'confirm') {
                            return;
                        }
                        switch (command) {
                            case 'Delete Favorite':
                                API.deleteFavorite({
                                    objectId: D.id
                                });
                                break;
                            case 'Make Home':
                                API.saveCurrentUser({
                                    homeLocation: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'Home world updated',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Reset Home':
                                API.saveCurrentUser({
                                    homeLocation: ''
                                }).then((args) => {
                                    this.$message({
                                        message: 'Home world has been reset',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Publish':
                                API.publishWorld({
                                    worldId: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'World has been published',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Unpublish':
                                API.unpublishWorld({
                                    worldId: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'World has been unpublished',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Delete':
                                API.deleteWorld({
                                    worldId: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'World has been deleted',
                                        type: 'success'
                                    });
                                    D.visible = false;
                                    return args;
                                });
                                break;
                        }
                    }
                });
                break;
        }
    };

    $app.methods.refreshWorldDialogTreeData = function () {
        var D = this.worldDialog;
        D.treeData = buildTreeData(D.ref);
    };

    $app.computed.worldDialogPlatform = function () {
        var { ref } = this.worldDialog;
        var platforms = [];
        if (ref.unityPackages) {
            for (var unityPackage of ref.unityPackages) {
                var platform = 'PC';
                if (unityPackage.platform === 'standalonewindows') {
                    platform = 'PC';
                } else if (unityPackage.platform === 'android') {
                    platform = 'Android';
                } else if (unityPackage.platform) {
                    ({ platform } = unityPackage);
                }
                platforms.unshift(`${platform}/${unityPackage.unityVersion}`);
            }
        }
        return platforms.join(', ');
    };

    // #endregion
    // #region | App: Avatar Dialog

    $app.data.avatarDialog = {
        visible: false,
        loading: false,
        id: '',
        memo: '',
        ref: {},
        isFavorite: false,
        isBlocked: false,
        isQuestFallback: false,
        hasImposter: false,
        treeData: [],
        fileSize: '',
        inCache: false,
        cacheSize: 0,
        cacheLocked: false,
        cachePath: '',
        fileAnalysis: {}
    };

    $app.data.ignoreAvatarMemoSave = false;

    $app.watch['avatarDialog.memo'] = function () {
        if (this.ignoreAvatarMemoSave) {
            this.ignoreAvatarMemoSave = false;
            return;
        }
        var D = this.avatarDialog;
        if (D.visible === false) {
            return;
        }
        this.saveAvatarMemo(D.id, D.memo);
    };

    API.$on('LOGOUT', function () {
        $app.avatarDialog.visible = false;
    });

    API.$on('FAVORITE', function (args) {
        var { ref } = args;
        var D = $app.avatarDialog;
        if (D.visible === false || ref.$isDeleted || ref.favoriteId !== D.id) {
            return;
        }
        D.isFavorite = true;
    });

    API.$on('FAVORITE:@DELETE', function (args) {
        var D = $app.avatarDialog;
        if (D.visible === false || D.id !== args.ref.favoriteId) {
            return;
        }
        D.isFavorite = false;
    });

    $app.methods.showAvatarDialog = function (avatarId) {
        this.$nextTick(() => adjustDialogZ(this.$refs.avatarDialog.$el));
        var D = this.avatarDialog;
        D.visible = true;
        D.loading = true;
        D.id = avatarId;
        D.fileAnalysis = {};
        D.treeData = [];
        D.fileSize = '';
        D.inCache = false;
        D.cacheSize = 0;
        D.cacheLocked = false;
        D.cachePath = '';
        D.isQuestFallback = false;
        D.hasImposter = false;
        D.isFavorite = API.cachedFavoritesByObjectId.has(avatarId);
        D.isBlocked = API.cachedAvatarModerations.has(avatarId);
        this.ignoreAvatarMemoSave = true;
        D.memo = '';
        var ref2 = API.cachedAvatars.get(avatarId);
        if (typeof ref2 !== 'undefined') {
            D.ref = ref2;
            this.updateVRChatAvatarCache();
            if (
                ref2.releaseStatus !== 'public' &&
                ref2.authorId !== API.currentUser.id
            ) {
                D.loading = false;
                return;
            }
        }
        API.getAvatar({ avatarId })
            .then((args) => {
                var { ref } = args;
                D.ref = ref;
                this.updateVRChatAvatarCache();
                if (
                    ref.imageUrl === API.currentUser.currentAvatarImageUrl &&
                    !ref.assetUrl
                ) {
                    D.ref.assetUrl = API.currentUser.currentAvatarAssetUrl;
                }
                if (/quest/.test(ref.tags)) {
                    D.isQuestFallback = true;
                }
                var assetUrl = '';
                for (let i = ref.unityPackages.length - 1; i > -1; i--) {
                    var unityPackage = ref.unityPackages[i];
                    if (
                        !assetUrl &&
                        unityPackage.platform === 'standalonewindows' &&
                        unityPackage.variant === 'standard' &&
                        this.compareUnityVersion(unityPackage.unityVersion)
                    ) {
                        assetUrl = unityPackage.assetUrl;
                    }
                    if (unityPackage.variant === 'impostor') {
                        D.hasImposter = true;
                    }
                }
                var fileId = extractFileId(assetUrl);
                var fileVersion = parseInt(extractFileVersion(assetUrl), 10);
                if (!fileId) {
                    fileId = extractFileId(ref.assetUrl);
                    fileVersion = parseInt(
                        extractFileVersion(ref.assetUrl),
                        10
                    );
                }
                D.fileSize = '';
                if (fileId) {
                    D.fileSize = 'Loading';
                    API.getBundles(fileId)
                        .then((args2) => {
                            var { versions } = args2.json;
                            for (let i = versions.length - 1; i > -1; i--) {
                                var version = versions[i];
                                if (version.version === fileVersion) {
                                    D.fileSize = `${(
                                        version.file.sizeInBytes / 1048576
                                    ).toFixed(2)} MB`;
                                    break;
                                }
                            }
                        })
                        .catch(() => {
                            D.fileSize = 'Error';
                        });
                }
            })
            .catch((err) => {
                D.loading = false;
                D.visible = false;
                throw err;
            })
            .finally(() => {
                D.loading = false;
            });
        this.getAvatarMemo(avatarId).then((memo) => {
            if (D.id === memo.avatarId) {
                this.ignoreAvatarMemoSave = true;
                D.memo = memo.memo;
            }
        });
    };

    $app.methods.avatarDialogCommand = function (command) {
        var D = this.avatarDialog;
        if (D.visible === false) {
            return;
        }
        switch (command) {
            case 'Refresh':
                this.showAvatarDialog(D.id);
                break;
            case 'Rename':
                this.promptRenameAvatar(D);
                break;
            case 'Change Image':
                this.displayPreviousImages('Avatar', 'Change');
                break;
            case 'Previous Images':
                this.displayPreviousImages('Avatar', 'Display');
                break;
            case 'Change Description':
                this.promptChangeAvatarDescription(D);
                break;
            case 'Change Content Tags':
                this.showSetAvatarTagsDialog(D.id);
                break;
            case 'Download Unity Package':
                this.openExternalLink(this.avatarDialog.ref.unityPackageUrl);
                break;
            case 'Add Favorite':
                this.showFavoriteDialog('avatar', D.id);
                break;
            default:
                this.$confirm(`Continue? ${command}`, 'Confirm', {
                    confirmButtonText: 'Confirm',
                    cancelButtonText: 'Cancel',
                    type: 'info',
                    callback: (action) => {
                        if (action !== 'confirm') {
                            return;
                        }
                        switch (command) {
                            case 'Delete Favorite':
                                API.deleteFavorite({
                                    objectId: D.id
                                });
                                break;
                            case 'Select Avatar':
                                API.selectAvatar({
                                    avatarId: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'Avatar changed',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Select Fallback Avatar':
                                API.selectFallbackAvatar({
                                    avatarId: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'Fallback avatar changed',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Block Avatar':
                                API.sendAvatarModeration({
                                    avatarModerationType: 'block',
                                    targetAvatarId: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'Avatar blocked',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Unblock Avatar':
                                API.deleteAvatarModeration({
                                    avatarModerationType: 'block',
                                    targetAvatarId: D.id
                                });
                                break;
                            case 'Make Public':
                                API.saveAvatar({
                                    id: D.id,
                                    releaseStatus: 'public'
                                }).then((args) => {
                                    this.$message({
                                        message: 'Avatar updated to public',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Make Private':
                                API.saveAvatar({
                                    id: D.id,
                                    releaseStatus: 'private'
                                }).then((args) => {
                                    this.$message({
                                        message: 'Avatar updated to private',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Delete':
                                API.deleteAvatar({
                                    avatarId: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'Avatar deleted',
                                        type: 'success'
                                    });
                                    D.visible = false;
                                    return args;
                                });
                                break;
                            case 'Delete Imposter':
                                API.deleteImposter({
                                    avatarId: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'Imposter deleted',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                            case 'Create Imposter':
                                API.createImposter({
                                    avatarId: D.id
                                }).then((args) => {
                                    this.$message({
                                        message: 'Imposter queued for creation',
                                        type: 'success'
                                    });
                                    return args;
                                });
                                break;
                        }
                    }
                });
                break;
        }
    };

    $app.methods.checkAvatarCache = function (fileId) {
        var avatarId = '';
        for (var ref of API.cachedAvatars.values()) {
            if (extractFileId(ref.imageUrl) === fileId) {
                avatarId = ref.id;
            }
        }
        return avatarId;
    };

    $app.methods.checkAvatarCacheRemote = async function (fileId, ownerUserId) {
        var avatarId = '';
        if (this.avatarRemoteDatabase) {
            var data = await this.lookupAvatars('authorId', ownerUserId);
            if (data && typeof data === 'object') {
                data.forEach((avatar) => {
                    if (extractFileId(avatar.imageUrl) === fileId) {
                        avatarId = avatar.id;
                    }
                });
            }
        }
        return avatarId;
    };

    $app.methods.showAvatarAuthorDialog = async function (
        refUserId,
        ownerUserId,
        currentAvatarImageUrl
    ) {
        var fileId = extractFileId(currentAvatarImageUrl);
        if (!fileId) {
            this.$message({
                message: 'Sorry, the author is unknown',
                type: 'error'
            });
        } else if (refUserId === API.currentUser.id) {
            this.showAvatarDialog(API.currentUser.currentAvatar);
        } else {
            var avatarId = await this.checkAvatarCache(fileId);
            if (!avatarId) {
                var avatarInfo = await this.getAvatarName(
                    currentAvatarImageUrl
                );
                if (avatarInfo.ownerId === API.currentUser.id) {
                    this.refreshUserDialogAvatars(fileId);
                }
            }
            if (!avatarId) {
                avatarId = await this.checkAvatarCacheRemote(
                    fileId,
                    avatarInfo.ownerId
                );
            }
            if (!avatarId) {
                if (avatarInfo.ownerId === refUserId) {
                    this.$message({
                        message: "It's personal (own) avatar",
                        type: 'warning'
                    });
                } else {
                    this.showUserDialog(avatarInfo.ownerId);
                }
            }
            if (avatarId) {
                this.showAvatarDialog(avatarId);
            }
        }
    };

    $app.methods.refreshAvatarDialogTreeData = function () {
        var D = this.avatarDialog;
        D.treeData = buildTreeData(D.ref);
    };

    $app.computed.avatarDialogPlatform = function () {
        var { ref } = this.avatarDialog;
        var platforms = [];
        if (ref.unityPackages) {
            for (var unityPackage of ref.unityPackages) {
                if (
                    unityPackage.variant &&
                    unityPackage.variant !== 'standard'
                ) {
                    continue;
                }
                var platform = 'PC';
                if (unityPackage.platform === 'standalonewindows') {
                    platform = 'PC';
                } else if (unityPackage.platform === 'android') {
                    platform = 'Android';
                } else if (unityPackage.platform) {
                    ({ platform } = unityPackage);
                }
                platforms.push(`${platform}/${unityPackage.unityVersion}`);
            }
        }
        return platforms.join(', ');
    };

    // #endregion
    // #region | App: Favorite Dialog

    $app.data.favoriteDialog = {
        visible: false,
        loading: false,
        type: '',
        objectId: '',
        groups: [],
        currentGroup: {}
    };

    API.$on('LOGOUT', function () {
        $app.favoriteDialog.visible = false;
    });

    $app.methods.addFavorite = function (group) {
        var D = this.favoriteDialog;
        D.loading = true;
        API.addFavorite({
            type: D.type,
            favoriteId: D.objectId,
            tags: group.name
        })
            .finally(() => {
                D.loading = false;
            })
            .then((args) => {
                return args;
            });
    };

    $app.methods.addFavoriteWorld = function (ref, group) {
        return API.addFavorite({
            type: 'world',
            favoriteId: ref.id,
            tags: group.name
        });
    };

    $app.methods.addFavoriteAvatar = function (ref, group) {
        return API.addFavorite({
            type: 'avatar',
            favoriteId: ref.id,
            tags: group.name
        });
    };

    $app.methods.addFavoriteUser = function (ref, group) {
        return API.addFavorite({
            type: 'friend',
            favoriteId: ref.id,
            tags: group.name
        });
    };

    $app.methods.moveFavorite = function (ref, group, type) {
        API.deleteFavorite({
            objectId: ref.id
        }).then(() => {
            API.addFavorite({
                type,
                favoriteId: ref.id,
                tags: group.name
            });
        });
    };

    $app.methods.showFavoriteDialog = function (type, objectId) {
        this.$nextTick(() => adjustDialogZ(this.$refs.favoriteDialog.$el));
        var D = this.favoriteDialog;
        D.type = type;
        D.objectId = objectId;
        if (type === 'friend') {
            D.groups = API.favoriteFriendGroups;
            D.visible = true;
        } else if (type === 'world') {
            D.groups = API.favoriteWorldGroups;
            D.visible = true;
        } else if (type === 'avatar') {
            D.groups = API.favoriteAvatarGroups;
            D.visible = true;
        }
        this.updateFavoriteDialog(objectId);
    };

    $app.methods.updateFavoriteDialog = function (objectId) {
        var D = this.favoriteDialog;
        if (!D.visible || D.objectId !== objectId) {
            return;
        }
        D.currentGroup = {};
        var favorite = this.favoriteObjects.get(objectId);
        if (favorite) {
            for (var group of API.favoriteWorldGroups) {
                if (favorite.groupKey === group.key) {
                    D.currentGroup = group;
                    return;
                }
            }
            for (var group of API.favoriteAvatarGroups) {
                if (favorite.groupKey === group.key) {
                    D.currentGroup = group;
                    return;
                }
            }
            for (var group of API.favoriteFriendGroups) {
                if (favorite.groupKey === group.key) {
                    D.currentGroup = group;
                    return;
                }
            }
        }
    };

    API.$on('FAVORITE:ADD', function (args) {
        $app.updateFavoriteDialog(args.params.favoriteId);
    });

    API.$on('FAVORITE:DELETE', function (args) {
        $app.updateFavoriteDialog(args.params.objectId);
    });

    // #endregion
    // #region | App: Invite Dialog

    $app.data.inviteDialog = {
        visible: false,
        loading: false,
        worldId: '',
        worldName: '',
        userIds: [],
        friendsInInstance: []
    };

    API.$on('LOGOUT', function () {
        $app.inviteDialog.visible = false;
    });

    $app.methods.sendInvite = function () {
        this.$confirm('Continue? Invite', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                var D = this.inviteDialog;
                if (action !== 'confirm' || D.loading === true) {
                    return;
                }
                if (
                    API.currentUser.status === 'busy' &&
                    D.userIds.includes(API.currentUser.id)
                ) {
                    this.$message({
                        message:
                            "You can't invite yourself in 'Do Not Disturb' mode",
                        type: 'error'
                    });
                    return;
                }
                D.loading = true;
                var inviteLoop = () => {
                    if (D.userIds.length > 0) {
                        var receiverUserId = D.userIds.shift();
                        if (receiverUserId === API.currentUser.id) {
                            // can't invite self!?
                            var L = API.parseLocation(D.worldId);
                            API.selfInvite({
                                instanceId: L.instanceId,
                                worldId: L.worldId
                            }).finally(inviteLoop);
                        } else {
                            API.sendInvite(
                                {
                                    instanceId: D.worldId,
                                    worldId: D.worldId,
                                    worldName: D.worldName
                                },
                                receiverUserId
                            ).finally(inviteLoop);
                        }
                    } else {
                        D.loading = false;
                        D.visible = false;
                        this.$message({
                            message: 'Invite sent',
                            type: 'success'
                        });
                    }
                };
                inviteLoop();
            }
        });
    };

    $app.methods.showInviteDialog = function (tag) {
        if (!this.isRealInstance(tag)) {
            return;
        }
        this.$nextTick(() => adjustDialogZ(this.$refs.inviteDialog.$el));
        var L = API.parseLocation(tag);
        API.getCachedWorld({
            worldId: L.worldId
        }).then((args) => {
            var D = this.inviteDialog;
            D.userIds = [];
            D.worldId = L.tag;
            D.worldName = args.ref.name;
            D.friendsInInstance = [];
            var friendsInCurrentInstance = this.lastLocation.friendList;
            for (var friend of friendsInCurrentInstance.values()) {
                var ctx = this.friends.get(friend.userId);
                if (typeof ctx.ref === 'undefined') {
                    continue;
                }
                D.friendsInInstance.push(ctx);
            }
            D.visible = true;
        });
    };

    // #endregion
    // #region | App: Social Status Dialog

    $app.data.socialStatusDialog = {
        visible: false,
        loading: false,
        status: '',
        statusDescription: ''
    };

    API.$on('LOGOUT', function () {
        $app.socialStatusDialog.visible = false;
    });

    $app.methods.saveSocialStatus = function () {
        var D = this.socialStatusDialog;
        if (D.loading) {
            return;
        }
        D.loading = true;
        API.saveCurrentUser({
            status: D.status,
            statusDescription: D.statusDescription
        })
            .finally(() => {
                D.loading = false;
            })
            .then((args) => {
                D.visible = false;
                this.$message({
                    message: 'Status updated',
                    type: 'success'
                });
                return args;
            });
    };

    $app.methods.showSocialStatusDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.socialStatusDialog.$el));
        var D = this.socialStatusDialog;
        var { statusHistory } = API.currentUser;
        var statusHistoryArray = [];
        for (var i = 0; i < statusHistory.length; ++i) {
            var addStatus = {
                no: i + 1,
                status: statusHistory[i]
            };
            statusHistoryArray.push(addStatus);
        }
        this.socialStatusHistoryTable.data = statusHistoryArray;
        D.status = API.currentUser.status;
        D.statusDescription = API.currentUser.statusDescription;
        D.visible = true;
    };

    $app.methods.setSocialStatusFromHistory = function (val) {
        if (val === null) {
            return;
        }
        var D = this.socialStatusDialog;
        D.statusDescription = val.status;
    };

    // #endregion
    // #region | App: Language Dialog

    $app.data.languageDialog = {
        visible: false,
        loading: false,
        languageChoice: false,
        languageValue: '',
        languages: (function () {
            var data = [];
            for (var key in subsetOfLanguages) {
                var value = subsetOfLanguages[key];
                data.push({
                    key,
                    value
                });
            }
            return data;
        })()
    };

    API.$on('LOGOUT', function () {
        $app.languageDialog.visible = false;
    });

    $app.methods.addUserLanguage = function (language) {
        if (language !== String(language)) {
            return;
        }
        var D = this.languageDialog;
        D.loading = true;
        API.addUserTags({
            tags: [`language_${language}`]
        }).finally(function () {
            D.loading = false;
        });
    };

    $app.methods.removeUserLanguage = function (language) {
        if (language !== String(language)) {
            return;
        }
        var D = this.languageDialog;
        D.loading = true;
        API.removeUserTags({
            tags: [`language_${language}`]
        }).finally(function () {
            D.loading = false;
        });
    };

    $app.methods.showLanguageDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.languageDialog.$el));
        var D = this.languageDialog;
        D.visible = true;
    };

    // #endregion
    // #region | App: Bio Dialog

    $app.data.bioDialog = {
        visible: false,
        loading: false,
        bio: '',
        bioLinks: []
    };

    API.$on('LOGOUT', function () {
        $app.bioDialog.visible = false;
    });

    $app.methods.saveBio = function () {
        var D = this.bioDialog;
        if (D.loading) {
            return;
        }
        D.loading = true;
        API.saveCurrentUser({
            bio: D.bio,
            bioLinks: D.bioLinks
        })
            .finally(() => {
                D.loading = false;
            })
            .then((args) => {
                D.visible = false;
                this.$message({
                    message: 'Bio updated',
                    type: 'success'
                });
                return args;
            });
    };

    $app.methods.showBioDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.bioDialog.$el));
        var D = this.bioDialog;
        D.bio = API.currentUser.bio;
        D.bioLinks = API.currentUser.bioLinks.slice();
        D.visible = true;
    };

    // #endregion
    // #region | App: New Instance Dialog

    $app.data.newInstanceDialog = {
        visible: false,
        loading: false,
        selectedTab: '0',
        instanceCreated: false,
        queueEnabled: false,
        worldId: '',
        instanceId: '',
        instanceName: '',
        userId: '',
        accessType: '',
        region: '',
        groupId: '',
        groupAccessType: '',
        strict: false,
        location: '',
        shortName: '',
        url: '',
        secureOrShortName: '',
        lastSelectedGroupId: '',
        selectedGroupRoles: [],
        roleIds: []
    };

    API.$on('LOGOUT', function () {
        $app.newInstanceDialog.visible = false;
    });

    $app.methods.buildInstance = function () {
        var D = this.newInstanceDialog;
        D.instanceCreated = false;
        D.shortName = '';
        D.secureOrShortName = '';
        var tags = [];
        if (D.instanceName) {
            D.instanceName = D.instanceName.replace(/[^A-Za-z0-9-_]/g, '');
            tags.push(D.instanceName);
        } else {
            var randValue = (99999 * Math.random() + 1).toFixed(0);
            tags.push(String(randValue).padStart(5, '0'));
        }
        if (!D.userId) {
            D.userId = API.currentUser.id;
        }
        var userId = D.userId;
        if (D.accessType !== 'public') {
            if (D.accessType === 'friends+') {
                tags.push(`~hidden(${userId})`);
            } else if (D.accessType === 'friends') {
                tags.push(`~friends(${userId})`);
            } else if (D.accessType === 'group') {
                tags.push(`~group(${D.groupId})`);
                tags.push(`~groupAccessType(${D.groupAccessType})`);
            } else {
                tags.push(`~private(${userId})`);
            }
            if (D.accessType === 'invite+') {
                tags.push('~canRequestInvite');
            }
        }
        if (D.region === 'US West') {
            tags.push(`~region(us)`);
        } else if (D.region === 'US East') {
            tags.push(`~region(use)`);
        } else if (D.region === 'Europe') {
            tags.push(`~region(eu)`);
        } else if (D.region === 'Japan') {
            tags.push(`~region(jp)`);
        }
        if (D.accessType !== 'invite' && D.accessType !== 'friends') {
            D.strict = false;
        }
        if (D.strict) {
            tags.push('~strict');
        }
        if (D.groupId && D.groupId !== D.lastSelectedGroupId) {
            D.roleIds = [];
            var ref = API.cachedGroups.get(D.groupId);
            if (typeof ref !== 'undefined') {
                D.selectedGroupRoles = ref.roles;
                API.getGroupRoles({
                    groupId: D.groupId
                }).then((args) => {
                    D.lastSelectedGroupId = D.groupId;
                    D.selectedGroupRoles = args.json;
                    ref.roles = args.json;
                });
            }
        }
        if (!D.groupId) {
            D.roleIds = [];
            D.selectedGroupRoles = [];
            D.lastSelectedGroupId = '';
        }
        D.instanceId = tags.join('');
        this.updateNewInstanceDialog(false);
        this.saveNewInstanceDialog();
    };

    $app.methods.createGroupInstance = function () {
        var D = this.newInstanceDialog;
        if (D.loading) {
            return;
        }
        D.loading = true;
        var region = 'us';
        if (D.region === 'US East') {
            region = 'use';
        } else if (D.region === 'Europe') {
            region = 'eu';
        } else if (D.region === 'Japan') {
            region = 'jp';
        }
        var roleIds = [];
        if (D.groupAccessType === 'member') {
            roleIds = D.roleIds;
        }
        API.createInstance({
            type: 'group',
            groupAccessType: D.groupAccessType,
            worldId: D.worldId,
            ownerId: D.groupId,
            region,
            queueEnabled: D.queueEnabled,
            roleIds
        })
            .then((args) => {
                D.location = args.json.location;
                D.instanceId = args.json.instanceId;
                D.secureOrShortName =
                    args.json.shortName || args.json.secureName;
                D.instanceCreated = true;
                this.updateNewInstanceDialog();
                return args;
            })
            .finally(() => {
                D.loading = false;
            });
    };

    $app.methods.selfInvite = function (location, shortName) {
        var L = API.parseLocation(location);
        if (L.isOffline || L.isTraveling || L.worldId === '') {
            return;
        }
        if (API.currentUser.status === 'busy') {
            this.$message({
                message:
                    "You cannot invite yourself in 'Do Not Disturb' status",
                type: 'error'
            });
            return;
        }
        API.selfInvite({
            instanceId: L.instanceId,
            worldId: L.worldId,
            shortName
        }).then((args) => {
            this.$message({
                message: 'Self invite sent',
                type: 'success'
            });
            return args;
        });
    };

    $app.methods.updateNewInstanceDialog = function (noChanges) {
        var D = this.newInstanceDialog;
        if (D.instanceId) {
            D.location = `${D.worldId}:${D.instanceId}`;
        } else {
            D.location = D.worldId;
        }
        var L = API.parseLocation(D.location);
        if (noChanges) {
            L.shortName = D.shortName;
        } else {
            D.shortName = '';
        }
        D.url = this.getLaunchURL(L);
    };

    $app.methods.saveNewInstanceDialog = async function () {
        await configRepository.setString(
            'instanceDialogAccessType',
            this.newInstanceDialog.accessType
        );
        await configRepository.setString(
            'instanceRegion',
            this.newInstanceDialog.region
        );
        await configRepository.setString(
            'instanceDialogInstanceName',
            this.newInstanceDialog.instanceName
        );
        if (this.newInstanceDialog.userId === API.currentUser.id) {
            await configRepository.setString('instanceDialogUserId', '');
        } else {
            await configRepository.setString(
                'instanceDialogUserId',
                this.newInstanceDialog.userId
            );
        }
        await configRepository.setString(
            'instanceDialogGroupId',
            this.newInstanceDialog.groupId
        );
        await configRepository.setString(
            'instanceDialogGroupAccessType',
            this.newInstanceDialog.groupAccessType
        );
        await configRepository.setBool(
            'instanceDialogStrict',
            this.newInstanceDialog.strict
        );
        await configRepository.setBool(
            'instanceDialogQueueEnabled',
            this.newInstanceDialog.queueEnabled
        );
    };

    $app.methods.showNewInstanceDialog = async function (tag) {
        if (!this.isRealInstance(tag)) {
            return;
        }
        this.$nextTick(() => adjustDialogZ(this.$refs.newInstanceDialog.$el));
        var D = this.newInstanceDialog;
        var L = API.parseLocation(tag);
        D.worldId = L.worldId;
        D.accessType = await configRepository.getString(
            'instanceDialogAccessType',
            'public'
        );
        D.region = await configRepository.getString(
            'instanceRegion',
            'US West'
        );
        D.instanceName = await configRepository.getString(
            'instanceDialogInstanceName',
            ''
        );
        D.userId = await configRepository.getString('instanceDialogUserId', '');
        D.groupId = await configRepository.getString(
            'instanceDialogGroupId',
            ''
        );
        D.groupAccessType = await configRepository.getString(
            'instanceDialogGroupAccessType',
            'plus'
        );
        D.queueEnabled = await configRepository.getBool(
            'instanceDialogQueueEnabled',
            true
        );
        D.instanceCreated = false;
        D.lastSelectedGroupId = '';
        D.selectedGroupRoles = [];
        D.roleIds = [];
        D.strict = false;
        D.shortName = '';
        D.secureOrShortName = '';
        this.buildInstance();
        this.updateNewInstanceDialog();
        D.visible = true;
    };

    $app.methods.makeHome = function (tag) {
        this.$confirm('Continue? Make Home', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action !== 'confirm') {
                    return;
                }
                API.saveCurrentUser({
                    homeLocation: tag
                }).then((args) => {
                    this.$message({
                        message: 'Home world updated',
                        type: 'success'
                    });
                    return args;
                });
            }
        });
    };

    // #endregion
    // #region | App: Launch Options Dialog

    $app.data.launchOptionsDialog = {
        visible: false,
        launchArguments: await configRepository.getString('launchArguments'),
        vrcLaunchPathOverride: await configRepository.getString(
            'vrcLaunchPathOverride'
        )
    };

    API.$on('LOGIN', async function () {
        var D = $app.launchOptionsDialog;
        if (
            D.vrcLaunchPathOverride === null ||
            D.vrcLaunchPathOverride === 'null'
        ) {
            D.vrcLaunchPathOverride = '';
            await configRepository.setString(
                'vrcLaunchPathOverride',
                D.vrcLaunchPathOverride
            );
        }
    });

    API.$on('LOGOUT', function () {
        $app.launchOptionsDialog.visible = false;
    });

    $app.methods.updateLaunchOptions = async function () {
        var D = this.launchOptionsDialog;
        D.visible = false;
        D.launchArguments = String(D.launchArguments)
            .replace(/\s+/g, ' ')
            .trim();
        await configRepository.setString('launchArguments', D.launchArguments);
        await configRepository.setString(
            'vrcLaunchPathOverride',
            D.vrcLaunchPathOverride
        );
        this.$message({
            message: 'Updated launch options',
            type: 'success'
        });
    };

    $app.methods.showLaunchOptions = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.launchOptionsDialog.$el));
        var D = this.launchOptionsDialog;
        D.visible = true;
    };

    // #endregion
    // #region | App: Set World Tags Dialog

    $app.data.setWorldTagsDialog = {
        visible: false,
        authorTags: [],
        contentTags: [],
        debugAllowed: false,
        avatarScalingDisabled: false,
        contentHorror: false,
        contentGore: false,
        contentViolence: false,
        contentAdult: false,
        contentSex: false
    };

    $app.methods.showSetWorldTagsDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.setWorldTagsDialog.$el));
        var D = this.setWorldTagsDialog;
        D.visible = true;
        D.debugAllowed = false;
        D.avatarScalingDisabled = false;
        D.contentHorror = false;
        D.contentGore = false;
        D.contentViolence = false;
        D.contentAdult = false;
        D.contentSex = false;
        var oldTags = this.worldDialog.ref.tags;
        var authorTags = [];
        var contentTags = [];
        oldTags.forEach((tag) => {
            if (tag.startsWith('author_tag_')) {
                authorTags.unshift(tag.substring(11));
            }
            if (tag.startsWith('content_')) {
                contentTags.unshift(tag.substring(8));
            }
            switch (tag) {
                case 'content_horror':
                    D.contentHorror = true;
                    break;
                case 'content_gore':
                    D.contentGore = true;
                    break;
                case 'content_violence':
                    D.contentViolence = true;
                    break;
                case 'content_adult':
                    D.contentAdult = true;
                    break;
                case 'content_sex':
                    D.contentSex = true;
                    break;

                case 'debug_allowed':
                    D.debugAllowed = true;
                    break;
                case 'feature_avatar_scaling_disabled':
                    D.avatarScalingDisabled = true;
                    break;
            }
        });
        D.authorTags = authorTags.toString();
        D.contentTags = contentTags.toString();
    };

    $app.methods.saveSetWorldTagsDialog = function () {
        var D = this.setWorldTagsDialog;
        var authorTags = D.authorTags.trim().split(',');
        var contentTags = D.contentTags.trim().split(',');
        var tags = [];
        authorTags.forEach((tag) => {
            if (tag) {
                tags.unshift(`author_tag_${tag}`);
            }
        });
        // add back custom tags
        contentTags.forEach((tag) => {
            switch (tag) {
                case 'horror':
                case 'gore':
                case 'violence':
                case 'adult':
                case 'sex':
                case '':
                    break;
                default:
                    tags.unshift(`content_${tag}`);
                    break;
            }
        });
        if (D.contentHorror) {
            tags.unshift('content_horror');
        }
        if (D.contentGore) {
            tags.unshift('content_gore');
        }
        if (D.contentViolence) {
            tags.unshift('content_violence');
        }
        if (D.contentAdult) {
            tags.unshift('content_adult');
        }
        if (D.contentSex) {
            tags.unshift('content_sex');
        }
        if (D.debugAllowed) {
            tags.unshift('debug_allowed');
        }
        if (D.avatarScalingDisabled) {
            tags.unshift('feature_avatar_scaling_disabled');
        }
        API.saveWorld({
            id: this.worldDialog.id,
            tags
        }).then((args) => {
            this.$message({
                message: 'Tags updated',
                type: 'success'
            });
            D.visible = false;
            if (
                this.worldDialog.visible &&
                this.worldDialog.id === args.json.id
            ) {
                this.showWorldDialog(args.json.id);
            }
            return args;
        });
    };

    // #endregion
    // #region | App: Set Avatar Tags Dialog

    $app.data.setAvatarTagsDialog = {
        visible: false,
        loading: false,
        ownAvatars: [],
        selectedCount: 0,
        forceUpdate: 0,
        contentHorror: false,
        contentGore: false,
        contentViolence: false,
        contentAdult: false,
        contentSex: false
    };

    $app.methods.showSetAvatarTagsDialog = function (avatarId) {
        this.$nextTick(() => adjustDialogZ(this.$refs.setAvatarTagsDialog.$el));
        var D = this.setAvatarTagsDialog;
        D.visible = true;
        D.loading = false;
        D.ownAvatars = [];
        D.forceUpdate = 0;
        D.contentHorror = false;
        D.contentGore = false;
        D.contentViolence = false;
        D.contentAdult = false;
        D.contentSex = false;
        var oldTags = this.avatarDialog.ref.tags;
        oldTags.forEach((tag) => {
            switch (tag) {
                case 'content_horror':
                    D.contentHorror = true;
                    break;
                case 'content_gore':
                    D.contentGore = true;
                    break;
                case 'content_violence':
                    D.contentViolence = true;
                    break;
                case 'content_adult':
                    D.contentAdult = true;
                    break;
                case 'content_sex':
                    D.contentSex = true;
                    break;
            }
        });
        for (var ref of API.cachedAvatars.values()) {
            if (ref.authorId === API.currentUser.id) {
                ref.$selected = false;
                ref.$tagString = '';
                if (avatarId === ref.id) {
                    ref.$selected = true;
                    var conentTags = [];
                    ref.tags.forEach((tag) => {
                        if (tag.startsWith('content_')) {
                            conentTags.push(tag.substring(8));
                        }
                    });
                    for (var i = 0; i < conentTags.length; ++i) {
                        var tag = conentTags[i];
                        if (i < conentTags.length - 1) {
                            ref.$tagString += `${tag}, `;
                        } else {
                            ref.$tagString += tag;
                        }
                    }
                }
                D.ownAvatars.push(ref);
            }
        }
        this.updateAvatarTagsSelection();
    };

    $app.data.avatarContentTags = [
        'content_horror',
        'content_gore',
        'content_violence',
        'content_adult',
        'content_sex'
    ];

    $app.methods.saveSetAvatarTagsDialog = async function () {
        var D = this.setAvatarTagsDialog;
        if (D.loading) {
            return;
        }
        D.loading = true;
        try {
            for (var i = D.ownAvatars.length - 1; i >= 0; --i) {
                var ref = D.ownAvatars[i];
                if (!D.visible) {
                    break;
                }
                if (!ref.$selected) {
                    continue;
                }
                var tags = ref.tags;
                if (D.contentHorror) {
                    if (!tags.includes('content_horror')) {
                        tags.push('content_horror');
                    }
                } else if (tags.includes('content_horror')) {
                    tags.splice(tags.indexOf('content_horror'), 1);
                }

                if (D.contentGore) {
                    if (!tags.includes('content_gore')) {
                        tags.push('content_gore');
                    }
                } else if (tags.includes('content_gore')) {
                    tags.splice(tags.indexOf('content_gore'), 1);
                }

                if (D.contentViolence) {
                    if (!tags.includes('content_violence')) {
                        tags.push('content_violence');
                    }
                } else if (tags.includes('content_violence')) {
                    tags.splice(tags.indexOf('content_violence'), 1);
                }

                if (D.contentAdult) {
                    if (!tags.includes('content_adult')) {
                        tags.push('content_adult');
                    }
                } else if (tags.includes('content_adult')) {
                    tags.splice(tags.indexOf('content_adult'), 1);
                }

                if (D.contentSex) {
                    if (!tags.includes('content_sex')) {
                        tags.push('content_sex');
                    }
                } else if (tags.includes('content_sex')) {
                    tags.splice(tags.indexOf('content_sex'), 1);
                }

                await API.saveAvatar({
                    id: ref.id,
                    tags
                });
                D.selectedCount--;
            }
        } catch (err) {
            this.$message({
                message: 'Error saving avatar tags',
                type: 'error'
            });
        } finally {
            D.loading = false;
            D.visible = false;
        }
    };

    $app.methods.updateAvatarTagsSelection = function () {
        var D = this.setAvatarTagsDialog;
        D.selectedCount = 0;
        for (var ref of D.ownAvatars) {
            if (ref.$selected) {
                D.selectedCount++;
            }
            ref.$tagString = '';
            var conentTags = [];
            ref.tags.forEach((tag) => {
                if (tag.startsWith('content_')) {
                    conentTags.push(tag.substring(8));
                }
            });
            for (var i = 0; i < conentTags.length; ++i) {
                var tag = conentTags[i];
                if (i < conentTags.length - 1) {
                    ref.$tagString += `${tag}, `;
                } else {
                    ref.$tagString += tag;
                }
            }
        }
        this.setAvatarTagsDialog.forceUpdate++;
    };

    $app.methods.setAvatarTagsSelectToggle = function () {
        var D = this.setAvatarTagsDialog;
        var allSelected = D.ownAvatars.length === D.selectedCount;
        for (var ref of D.ownAvatars) {
            ref.$selected = !allSelected;
        }
        this.updateAvatarTagsSelection();
    };

    // #endregion
    // #region | App: Notification position

    $app.data.notificationPositionDialog = {
        visible: false
    };

    $app.methods.showNotificationPositionDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.notificationPositionDialog.$el)
        );
        this.notificationPositionDialog.visible = true;
    };

    // #endregion
    // #region | App: Noty feed filters

    $app.data.notyFeedFiltersDialog = {
        visible: false
    };

    $app.methods.showNotyFeedFiltersDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.notyFeedFiltersDialog.$el)
        );
        this.notyFeedFiltersDialog.visible = true;
    };

    // #endregion
    // #region | App: Wrist feed filters

    $app.data.wristFeedFiltersDialog = {
        visible: false
    };

    $app.methods.showWristFeedFiltersDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.wristFeedFiltersDialog.$el)
        );
        this.wristFeedFiltersDialog.visible = true;
    };

    // #endregion
    // #region | App: Launch Dialog

    $app.data.launchDialog = {
        visible: false,
        loading: false,
        desktop: await configRepository.getBool('launchAsDesktop'),
        tag: '',
        location: '',
        url: '',
        shortName: '',
        shortUrl: '',
        secureOrShortName: ''
    };

    $app.methods.saveLaunchDialog = async function () {
        await configRepository.setBool(
            'launchAsDesktop',
            this.launchDialog.desktop
        );
    };

    API.$on('LOGOUT', function () {
        $app.launchDialog.visible = false;
    });

    API.$on('INSTANCE:SHORTNAME', function (args) {
        if (!args.json) {
            return;
        }
        var shortName = args.json.shortName;
        var secureOrShortName = args.json.shortName || args.json.secureName;
        var location = `${args.instance.worldId}:${args.instance.instanceId}`;
        if (location === $app.launchDialog.tag) {
            var L = this.parseLocation(location);
            L.shortName = shortName;
            $app.launchDialog.shortName = shortName;
            $app.launchDialog.secureOrShortName = secureOrShortName;
            if (shortName) {
                $app.launchDialog.shortUrl = `https://vrch.at/${shortName}`;
            }
            $app.launchDialog.url = $app.getLaunchURL(L);
        }
        if (location === $app.newInstanceDialog.location) {
            $app.newInstanceDialog.shortName = shortName;
            $app.newInstanceDialog.secureOrShortName = secureOrShortName;
            $app.updateNewInstanceDialog(true);
        }
    });

    $app.methods.addShortNameToFullUrl = function (input, shortName) {
        if (input.trim().length === 0 || !shortName) {
            return input;
        }
        var url = new URL(input);
        var urlParams = new URLSearchParams(url.search);
        urlParams.set('shortName', shortName);
        url.search = urlParams.toString();
        return url.toString();
    };

    $app.methods.showLaunchDialog = function (tag, shortName) {
        if (!this.isRealInstance(tag)) {
            return;
        }
        this.$nextTick(() => adjustDialogZ(this.$refs.launchDialog.$el));
        var D = this.launchDialog;
        D.tag = tag;
        D.secureOrShortName = shortName;
        D.shortUrl = '';
        D.shortName = shortName;
        var L = API.parseLocation(tag);
        L.shortName = shortName;
        if (shortName) {
            D.shortUrl = `https://vrch.at/${shortName}`;
        }
        if (L.instanceId) {
            D.location = `${L.worldId}:${L.instanceId}`;
        } else {
            D.location = L.worldId;
        }
        D.url = this.getLaunchURL(L);
        D.visible = true;
        if (!shortName) {
            API.getInstanceShortName({
                worldId: L.worldId,
                instanceId: L.instanceId
            });
        }
    };

    $app.methods.getLaunchURL = function (instance) {
        var L = instance;
        if (L.instanceId) {
            if (L.shortName) {
                return `https://vrchat.com/home/launch?worldId=${encodeURIComponent(
                    L.worldId
                )}&instanceId=${encodeURIComponent(
                    L.instanceId
                )}&shortName=${encodeURIComponent(L.shortName)}`;
            }
            return `https://vrchat.com/home/launch?worldId=${encodeURIComponent(
                L.worldId
            )}&instanceId=${encodeURIComponent(L.instanceId)}`;
        }
        return `https://vrchat.com/home/launch?worldId=${encodeURIComponent(
            L.worldId
        )}`;
    };

    $app.methods.launchGame = async function (
        location,
        shortName,
        desktopMode
    ) {
        var D = this.launchDialog;
        var L = API.parseLocation(location);
        var args = [];
        if (
            shortName &&
            L.instanceType !== 'public' &&
            L.groupAccessType !== 'public'
        ) {
            args.push(`vrchat://launch?id=${location}&shortName=${shortName}`);
        } else {
            // fetch shortName
            var newShortName = '';
            var response = await API.getInstanceShortName({
                worldId: L.worldId,
                instanceId: L.instanceId
            });
            if (response.json) {
                if (response.json.shortName) {
                    newShortName = response.json.shortName;
                } else {
                    newShortName = response.json.secureName;
                }
            }
            if (newShortName) {
                args.push(
                    `vrchat://launch?id=${location}&shortName=${newShortName}`
                );
            } else {
                args.push(`vrchat://launch?id=${location}`);
            }
        }
        var { launchArguments, vrcLaunchPathOverride } =
            this.launchOptionsDialog;
        if (launchArguments) {
            args.push(launchArguments);
        }
        if (desktopMode) {
            args.push('--no-vr');
        }
        if (vrcLaunchPathOverride) {
            AppApi.StartGameFromPath(
                vrcLaunchPathOverride,
                args.join(' ')
            ).then((result) => {
                if (!result) {
                    this.$message({
                        message:
                            'Failed to launch VRChat, invalid custom path set',
                        type: 'error'
                    });
                } else {
                    this.$message({
                        message: 'VRChat launched',
                        type: 'success'
                    });
                }
            });
        } else {
            AppApi.StartGame(args.join(' '));
            this.$message({
                message: 'VRChat launched',
                type: 'success'
            });
        }
        console.log('Launch Game', args.join(' '), desktopMode);
        D.visible = false;
    };

    // #endregion
    // #region | App: Copy To Clipboard

    $app.methods.copyToClipboard = function (text) {
        var textArea = document.createElement('textarea');
        textArea.id = 'copy_to_clipboard';
        textArea.value = text;
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.getElementById('copy_to_clipboard').remove();
    };

    $app.methods.copyInstanceMessage = function (input) {
        this.copyToClipboard(input);
        this.$message({
            message: 'Instance copied to clipboard',
            type: 'success'
        });
        return input;
    };

    $app.methods.copyInstanceUrl = async function (location) {
        var L = API.parseLocation(location);
        var args = await API.getInstanceShortName({
            worldId: L.worldId,
            instanceId: L.instanceId
        });
        if (args.json && args.json.shortName) {
            L.shortName = args.json.shortName;
        }
        var newUrl = this.getLaunchURL(L);
        this.copyInstanceMessage(newUrl);
    };

    $app.methods.copyAvatarId = function (avatarId) {
        this.$message({
            message: 'Avatar ID copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(avatarId);
    };

    $app.methods.copyAvatarUrl = function (avatarId) {
        this.$message({
            message: 'Avatar URL copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(`https://vrchat.com/home/avatar/${avatarId}`);
    };

    $app.methods.copyWorldId = function (worldId) {
        this.$message({
            message: 'World ID copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(worldId);
    };

    $app.methods.copyWorldUrl = function (worldId) {
        this.$message({
            message: 'World URL copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(`https://vrchat.com/home/world/${worldId}`);
    };

    $app.methods.copyWorldName = function (worldName) {
        this.$message({
            message: 'World name copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(worldName);
    };

    $app.methods.copyUserId = function (userId) {
        this.$message({
            message: 'User ID copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(userId);
    };

    $app.methods.copyUserURL = function (userId) {
        this.$message({
            message: 'User URL copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(`https://vrchat.com/home/user/${userId}`);
    };

    $app.methods.copyUserDisplayName = function (displayName) {
        this.$message({
            message: 'User DisplayName copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(displayName);
    };

    $app.methods.copyGroupId = function (groupId) {
        this.$message({
            message: 'Group ID copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(groupId);
    };

    $app.methods.copyGroupUrl = function (groupUrl) {
        this.$message({
            message: 'Group URL copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(groupUrl);
    };

    $app.methods.copyImageUrl = function (imageUrl) {
        this.$message({
            message: 'ImageUrl copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(imageUrl);
    };

    $app.methods.copyText = function (text) {
        this.$message({
            message: 'Text copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(text);
    };

    $app.methods.copyLink = function (text) {
        this.$message({
            message: 'Link copied to clipboard',
            type: 'success'
        });
        this.copyToClipboard(text);
    };

    // #endregion
    // #region | App: VRCPlus Icons

    API.$on('LOGIN', function () {
        $app.VRCPlusIconsTable = [];
    });

    $app.methods.refreshVRCPlusIconsTable = function () {
        this.galleryDialogIconsLoading = true;
        var params = {
            n: 100,
            tag: 'icon'
        };
        API.getFileList(params);
    };

    API.getFileList = function (params) {
        return this.call('files', {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FILES:LIST', args);
            return args;
        });
    };

    API.$on('FILES:LIST', function (args) {
        if (args.params.tag === 'icon') {
            $app.VRCPlusIconsTable = args.json.reverse();
            $app.galleryDialogIconsLoading = false;
        }
    });

    $app.methods.setVRCPlusIcon = function (fileId) {
        if (!API.currentUser.$isVRCPlus) {
            this.$message({
                message: 'VRCPlus required',
                type: 'error'
            });
            return;
        }
        var userIcon = '';
        if (fileId) {
            userIcon = `${API.endpointDomain}/file/${fileId}/1`;
        }
        if (userIcon === API.currentUser.userIcon) {
            return;
        }
        API.saveCurrentUser({
            userIcon
        }).then((args) => {
            this.$message({
                message: 'Icon changed',
                type: 'success'
            });
            return args;
        });
    };

    $app.methods.deleteVRCPlusIcon = function (fileId) {
        API.deleteFile(fileId).then((args) => {
            API.$emit('VRCPLUSICON:DELETE', args);
            return args;
        });
    };

    API.$on('VRCPLUSICON:DELETE', function (args) {
        var array = $app.VRCPlusIconsTable;
        var { length } = array;
        for (var i = 0; i < length; ++i) {
            if (args.fileId === array[i].id) {
                array.splice(i, 1);
                break;
            }
        }
    });

    API.deleteFile = function (fileId) {
        return this.call(`file/${fileId}`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                fileId
            };
            return args;
        });
    };

    API.deleteFileVersion = function (params) {
        return this.call(`file/${params.fileId}/${params.version}`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                params
            };
            return args;
        });
    };

    $app.methods.compareCurrentVRCPlusIcon = function (userIcon) {
        var currentUserIcon = extractFileId(API.currentUser.userIcon);
        if (userIcon === currentUserIcon) {
            return true;
        }
        return false;
    };

    $app.methods.onFileChangeVRCPlusIcon = function (e) {
        var clearFile = function () {
            if (document.querySelector('#VRCPlusIconUploadButton')) {
                document.querySelector('#VRCPlusIconUploadButton').value = '';
            }
        };
        var files = e.target.files || e.dataTransfer.files;
        if (!files.length) {
            return;
        }
        if (files[0].size >= 10000000) {
            // 10MB
            $app.$message({
                message: 'File size too large',
                type: 'error'
            });
            clearFile();
            return;
        }
        if (!files[0].type.match(/image.*/)) {
            $app.$message({
                message: "File isn't an image",
                type: 'error'
            });
            clearFile();
            return;
        }
        var r = new FileReader();
        r.onload = function () {
            var base64Body = btoa(r.result);
            API.uploadVRCPlusIcon(base64Body).then((args) => {
                $app.$message({
                    message: 'Icon uploaded',
                    type: 'success'
                });
                return args;
            });
        };
        r.readAsBinaryString(files[0]);
        clearFile();
    };

    $app.methods.displayVRCPlusIconUpload = function () {
        document.getElementById('VRCPlusIconUploadButton').click();
    };

    API.uploadVRCPlusIcon = function (imageData) {
        var params = {
            tag: 'icon'
        };
        return this.call('file/image', {
            uploadImage: true,
            postData: JSON.stringify(params),
            imageData
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('VRCPLUSICON:ADD', args);
            return args;
        });
    };

    API.$on('VRCPLUSICON:ADD', function (args) {
        if (Object.keys($app.VRCPlusIconsTable).length !== 0) {
            $app.VRCPlusIconsTable.push(args.json);
        }
    });

    $app.data.uploadImage = '';

    $app.methods.inviteImageUpload = function (e) {
        var files = e.target.files || e.dataTransfer.files;
        if (!files.length) {
            return;
        }
        if (files[0].size >= 10000000) {
            // 10MB
            $app.$message({
                message: 'File size too large',
                type: 'error'
            });
            this.clearInviteImageUpload();
            return;
        }
        if (!files[0].type.match(/image.png/)) {
            $app.$message({
                message: "File isn't a png",
                type: 'error'
            });
            this.clearInviteImageUpload();
            return;
        }
        var r = new FileReader();
        r.onload = function () {
            $app.uploadImage = btoa(r.result);
        };
        r.readAsBinaryString(files[0]);
    };

    $app.methods.clearInviteImageUpload = function () {
        var buttonList = document.querySelectorAll('.inviteImageUploadButton');
        buttonList.forEach((button) => (button.value = ''));
        this.uploadImage = '';
    };

    $app.methods.userOnlineFor = function (ctx) {
        if (ctx.ref.state === 'online' && ctx.ref.$online_for) {
            return Date.now() - ctx.ref.$online_for;
        } else if (ctx.ref.$offline_for) {
            return Date.now() - ctx.ref.$offline_for;
        }
        return '-';
    };

    $app.methods.userOnlineForTimestamp = function (ctx) {
        if (ctx.ref.state === 'online' && ctx.ref.$online_for) {
            return ctx.ref.$online_for;
        } else if (ctx.ref.$offline_for) {
            return ctx.ref.$offline_for;
        }
        return 0;
    };

    // #endregion
    // #region | App: Invite Messages

    API.$on('LOGIN', function () {
        $app.inviteMessageTable.data = [];
        $app.inviteResponseMessageTable.data = [];
        $app.inviteRequestMessageTable.data = [];
        $app.inviteRequestResponseMessageTable.data = [];
        $app.inviteMessageTable.visible = false;
        $app.inviteResponseMessageTable.visible = false;
        $app.inviteRequestMessageTable.visible = false;
        $app.inviteRequestResponseMessageTable.visible = false;
    });

    $app.methods.refreshInviteMessageTable = function (messageType) {
        API.refreshInviteMessageTableData(messageType);
    };

    API.refreshInviteMessageTableData = function (messageType) {
        return this.call(`message/${this.currentUser.id}/${messageType}`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                messageType
            };
            this.$emit(`INVITE:${messageType.toUpperCase()}`, args);
            return args;
        });
    };

    API.$on('INVITE:MESSAGE', function (args) {
        $app.inviteMessageTable.data = args.json;
    });

    API.$on('INVITE:RESPONSE', function (args) {
        $app.inviteResponseMessageTable.data = args.json;
    });

    API.$on('INVITE:REQUEST', function (args) {
        $app.inviteRequestMessageTable.data = args.json;
    });

    API.$on('INVITE:REQUESTRESPONSE', function (args) {
        $app.inviteRequestResponseMessageTable.data = args.json;
    });

    API.editInviteMessage = function (params, messageType, slot) {
        return this.call(
            `message/${this.currentUser.id}/${messageType}/${slot}`,
            {
                method: 'PUT',
                params
            }
        ).then((json) => {
            var args = {
                json,
                params,
                messageType,
                slot
            };
            return args;
        });
    };

    // #endregion
    // #region | App: Edit Invite Message Dialog

    $app.data.editInviteMessageDialog = {
        visible: false,
        inviteMessage: {},
        messageType: '',
        newMessage: ''
    };

    $app.methods.showEditInviteMessageDialog = function (
        messageType,
        inviteMessage
    ) {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.editInviteMessageDialog.$el)
        );
        var D = this.editInviteMessageDialog;
        D.newMessage = inviteMessage.message;
        D.visible = true;
        D.inviteMessage = inviteMessage;
        D.messageType = messageType;
    };

    $app.methods.saveEditInviteMessage = function () {
        var D = this.editInviteMessageDialog;
        D.visible = false;
        if (D.inviteMessage.message !== D.newMessage) {
            var slot = D.inviteMessage.slot;
            var messageType = D.messageType;
            var params = {
                message: D.newMessage
            };
            API.editInviteMessage(params, messageType, slot)
                .catch((err) => {
                    throw err;
                })
                .then((args) => {
                    API.$emit(`INVITE:${messageType.toUpperCase()}`, args);
                    if (args.json[slot].message === D.inviteMessage.message) {
                        this.$message({
                            message:
                                "VRChat API didn't update message, try again",
                            type: 'error'
                        });
                        throw new Error(
                            "VRChat API didn't update message, try again"
                        );
                    } else {
                        this.$message('Invite message updated');
                    }
                    return args;
                });
        }
    };

    $app.methods.cancelEditInviteMessage = function () {
        this.editInviteMessageDialog.visible = false;
    };

    // #endregion
    // #region | App: Edit and Send Invite Response Message Dialog

    $app.data.editAndSendInviteResponseDialog = {
        visible: false,
        inviteMessage: {},
        messageType: '',
        newMessage: ''
    };

    $app.methods.showEditAndSendInviteResponseDialog = function (
        messageType,
        inviteMessage
    ) {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.editAndSendInviteResponseDialog.$el)
        );
        this.editAndSendInviteResponseDialog = {
            newMessage: inviteMessage.message,
            visible: true,
            messageType,
            inviteMessage
        };
    };

    $app.methods.saveEditAndSendInviteResponse = async function () {
        var D = this.editAndSendInviteResponseDialog;
        D.visible = false;
        var messageType = D.messageType;
        var slot = D.inviteMessage.slot;
        if (D.inviteMessage.message !== D.newMessage) {
            var params = {
                message: D.newMessage
            };
            await API.editInviteMessage(params, messageType, slot)
                .catch((err) => {
                    throw err;
                })
                .then((args) => {
                    API.$emit(`INVITE:${messageType.toUpperCase()}`, args);
                    if (args.json[slot].message === D.inviteMessage.message) {
                        this.$message({
                            message:
                                "VRChat API didn't update message, try again",
                            type: 'error'
                        });
                        throw new Error(
                            "VRChat API didn't update message, try again"
                        );
                    } else {
                        this.$message('Invite message updated');
                    }
                    return args;
                });
        }
        var I = this.sendInviteResponseDialog;
        var params = {
            responseSlot: slot,
            rsvp: true
        };
        if ($app.uploadImage) {
            API.sendInviteResponsePhoto(params, I.invite.id)
                .catch((err) => {
                    throw err;
                })
                .then((args) => {
                    API.hideNotification({
                        notificationId: I.invite.id
                    });
                    this.$message({
                        message: 'Invite response message sent',
                        type: 'success'
                    });
                    this.sendInviteResponseDialogVisible = false;
                    this.sendInviteRequestResponseDialogVisible = false;
                    return args;
                });
        } else {
            API.sendInviteResponse(params, I.invite.id)
                .catch((err) => {
                    throw err;
                })
                .then((args) => {
                    API.hideNotification({
                        notificationId: I.invite.id
                    });
                    this.$message({
                        message: 'Invite response message sent',
                        type: 'success'
                    });
                    this.sendInviteResponseDialogVisible = false;
                    this.sendInviteRequestResponseDialogVisible = false;
                    return args;
                });
        }
    };

    $app.methods.cancelEditAndSendInviteResponse = function () {
        this.editAndSendInviteResponseDialog.visible = false;
    };

    $app.data.sendInviteResponseDialog = {
        message: '',
        messageSlot: 0,
        invite: {}
    };

    $app.data.sendInviteResponseDialogVisible = false;

    $app.data.sendInviteResponseConfirmDialog = {
        visible: false
    };

    API.$on('LOGIN', function () {
        $app.sendInviteResponseDialogVisible = false;
        $app.sendInviteResponseConfirmDialog.visible = false;
    });

    $app.methods.showSendInviteResponseDialog = function (invite) {
        this.sendInviteResponseDialog = {
            invite
        };
        API.refreshInviteMessageTableData('response');
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.sendInviteResponseDialog.$el)
        );
        this.clearInviteImageUpload();
        this.sendInviteResponseDialogVisible = true;
    };

    $app.methods.showSendInviteResponseConfirmDialog = function (val) {
        if (
            this.editAndSendInviteResponseDialog.visible === true ||
            val === null
        ) {
            return;
        }
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.sendInviteResponseConfirmDialog.$el)
        );
        this.sendInviteResponseConfirmDialog.visible = true;
        this.sendInviteResponseDialog.messageSlot = val.slot;
    };

    $app.methods.cancelSendInviteResponse = function () {
        this.sendInviteResponseDialogVisible = false;
    };

    $app.methods.cancelInviteResponseConfirm = function () {
        this.sendInviteResponseConfirmDialog.visible = false;
    };

    $app.methods.sendInviteResponseConfirm = function () {
        var D = this.sendInviteResponseDialog;
        var params = {
            responseSlot: D.messageSlot,
            rsvp: true
        };
        if ($app.uploadImage) {
            API.sendInviteResponsePhoto(params, D.invite.id, D.messageType)
                .catch((err) => {
                    throw err;
                })
                .then((args) => {
                    API.hideNotification({
                        notificationId: D.invite.id
                    });
                    this.$message({
                        message: 'Invite response photo message sent',
                        type: 'success'
                    });
                    return args;
                });
        } else {
            API.sendInviteResponse(params, D.invite.id, D.messageType)
                .catch((err) => {
                    throw err;
                })
                .then((args) => {
                    API.hideNotification({
                        notificationId: D.invite.id
                    });
                    this.$message({
                        message: 'Invite response message sent',
                        type: 'success'
                    });
                    return args;
                });
        }
        this.sendInviteResponseDialogVisible = false;
        this.sendInviteRequestResponseDialogVisible = false;
        this.sendInviteResponseConfirmDialog.visible = false;
    };

    // #endregion
    // #region | App: Invite Request Response Message Dialog

    $app.data.sendInviteRequestResponseDialogVisible = false;

    $app.methods.cancelSendInviteRequestResponse = function () {
        this.sendInviteRequestResponseDialogVisible = false;
    };

    API.$on('LOGIN', function () {
        $app.sendInviteRequestResponseDialogVisible = false;
        $app.showSendInviteResponseConfirmDialog.visible = false;
    });

    $app.methods.showSendInviteRequestResponseDialog = function (invite) {
        this.sendInviteResponseDialog = {
            invite
        };
        API.refreshInviteMessageTableData('requestResponse');
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.sendInviteRequestResponseDialog.$el)
        );
        this.clearInviteImageUpload();
        this.sendInviteRequestResponseDialogVisible = true;
    };

    // #endregion
    // #region | App: Invite Message Dialog

    $app.data.editAndSendInviteDialog = {
        visible: false,
        messageType: '',
        newMessage: '',
        inviteMessage: {}
    };

    $app.methods.showEditAndSendInviteDialog = function (
        messageType,
        inviteMessage
    ) {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.editAndSendInviteDialog.$el)
        );
        this.editAndSendInviteDialog = {
            newMessage: inviteMessage.message,
            visible: true,
            messageType,
            inviteMessage
        };
    };

    $app.methods.saveEditAndSendInvite = async function () {
        var D = this.editAndSendInviteDialog;
        D.visible = false;
        var messageType = D.messageType;
        var slot = D.inviteMessage.slot;
        if (D.inviteMessage.message !== D.newMessage) {
            var params = {
                message: D.newMessage
            };
            await API.editInviteMessage(params, messageType, slot)
                .catch((err) => {
                    throw err;
                })
                .then((args) => {
                    API.$emit(`INVITE:${messageType.toUpperCase()}`, args);
                    if (args.json[slot].message === D.inviteMessage.message) {
                        this.$message({
                            message:
                                "VRChat API didn't update message, try again",
                            type: 'error'
                        });
                        throw new Error(
                            "VRChat API didn't update message, try again"
                        );
                    } else {
                        this.$message('Invite message updated');
                    }
                    return args;
                });
        }
        var I = this.sendInviteDialog;
        var J = this.inviteDialog;
        if (J.visible) {
            if (
                API.currentUser.status === 'busy' &&
                J.userIds.includes(API.currentUser.id)
            ) {
                this.$message({
                    message:
                        "You can't invite yourself in 'Do Not Disturb' mode",
                    type: 'error'
                });
                return;
            }
            var inviteLoop = () => {
                if (J.userIds.length > 0) {
                    var receiverUserId = J.userIds.shift();
                    if (receiverUserId === API.currentUser.id) {
                        // can't invite self!?
                        var L = API.parseLocation(J.worldId);
                        API.selfInvite({
                            instanceId: L.instanceId,
                            worldId: L.worldId
                        }).finally(inviteLoop);
                    } else if ($app.uploadImage) {
                        API.sendInvitePhoto(
                            {
                                instanceId: J.worldId,
                                worldId: J.worldId,
                                worldName: J.worldName,
                                messageSlot: slot
                            },
                            receiverUserId
                        ).finally(inviteLoop);
                    } else {
                        API.sendInvite(
                            {
                                instanceId: J.worldId,
                                worldId: J.worldId,
                                worldName: J.worldName,
                                messageSlot: slot
                            },
                            receiverUserId
                        ).finally(inviteLoop);
                    }
                } else {
                    J.loading = false;
                    J.visible = false;
                    this.$message({
                        message: 'Invite sent',
                        type: 'success'
                    });
                }
            };
            inviteLoop();
        } else if (I.messageType === 'invite') {
            I.params.messageSlot = slot;
            if ($app.uploadImage) {
                API.sendInvitePhoto(I.params, I.userId)
                    .catch((err) => {
                        throw err;
                    })
                    .then((args) => {
                        this.$message({
                            message: 'Invite photo message sent',
                            type: 'success'
                        });
                        return args;
                    });
            } else {
                API.sendInvite(I.params, I.userId)
                    .catch((err) => {
                        throw err;
                    })
                    .then((args) => {
                        this.$message({
                            message: 'Invite message sent',
                            type: 'success'
                        });
                        return args;
                    });
            }
        } else if (I.messageType === 'requestInvite') {
            I.params.requestSlot = slot;
            if ($app.uploadImage) {
                API.sendRequestInvitePhoto(I.params, I.userId)
                    .catch((err) => {
                        this.clearInviteImageUpload();
                        throw err;
                    })
                    .then((args) => {
                        this.$message({
                            message: 'Request invite photo message sent',
                            type: 'success'
                        });
                        return args;
                    });
            } else {
                API.sendRequestInvite(I.params, I.userId)
                    .catch((err) => {
                        throw err;
                    })
                    .then((args) => {
                        this.$message({
                            message: 'Request invite message sent',
                            type: 'success'
                        });
                        return args;
                    });
            }
        }
        this.sendInviteDialogVisible = false;
        this.sendInviteRequestDialogVisible = false;
    };

    $app.methods.cancelEditAndSendInvite = function () {
        this.editAndSendInviteDialog.visible = false;
    };

    $app.data.sendInviteDialog = {
        message: '',
        messageSlot: 0,
        userId: '',
        messageType: '',
        params: {}
    };

    $app.data.sendInviteDialogVisible = false;

    $app.data.sendInviteConfirmDialog = {
        visible: false
    };

    API.$on('LOGIN', function () {
        $app.sendInviteDialogVisible = false;
        $app.sendInviteConfirmDialog.visible = false;
    });

    $app.methods.showSendInviteDialog = function (params, userId) {
        this.sendInviteDialog = {
            params,
            userId,
            messageType: 'invite'
        };
        API.refreshInviteMessageTableData('message');
        this.$nextTick(() => adjustDialogZ(this.$refs.sendInviteDialog.$el));
        this.clearInviteImageUpload();
        this.sendInviteDialogVisible = true;
    };

    $app.methods.showSendInviteConfirmDialog = function (val) {
        if (this.editAndSendInviteDialog.visible === true || val === null) {
            return;
        }
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.sendInviteConfirmDialog.$el)
        );
        this.sendInviteConfirmDialog.visible = true;
        this.sendInviteDialog.messageSlot = val.slot;
    };

    $app.methods.cancelSendInvite = function () {
        this.sendInviteDialogVisible = false;
    };

    $app.methods.cancelInviteConfirm = function () {
        this.sendInviteConfirmDialog.visible = false;
    };

    $app.methods.sendInviteConfirm = function () {
        var D = this.sendInviteDialog;
        var J = this.inviteDialog;
        if (J.visible) {
            if (
                API.currentUser.status === 'busy' &&
                J.userIds.includes(API.currentUser.id)
            ) {
                this.$message({
                    message:
                        "You can't invite yourself in 'Do Not Disturb' mode",
                    type: 'error'
                });
                return;
            }
            var inviteLoop = () => {
                if (J.userIds.length > 0) {
                    var receiverUserId = J.userIds.shift();
                    if (receiverUserId === API.currentUser.id) {
                        // can't invite self!?
                        var L = API.parseLocation(J.worldId);
                        API.selfInvite({
                            instanceId: L.instanceId,
                            worldId: L.worldId
                        }).finally(inviteLoop);
                    } else if ($app.uploadImage) {
                        API.sendInvitePhoto(
                            {
                                instanceId: J.worldId,
                                worldId: J.worldId,
                                worldName: J.worldName,
                                messageSlot: D.messageSlot
                            },
                            receiverUserId
                        ).finally(inviteLoop);
                    } else {
                        API.sendInvite(
                            {
                                instanceId: J.worldId,
                                worldId: J.worldId,
                                worldName: J.worldName,
                                messageSlot: D.messageSlot
                            },
                            receiverUserId
                        ).finally(inviteLoop);
                    }
                } else {
                    J.loading = false;
                    J.visible = false;
                    this.$message({
                        message: 'Invite message sent',
                        type: 'success'
                    });
                }
            };
            inviteLoop();
        } else if (D.messageType === 'invite') {
            D.params.messageSlot = D.messageSlot;
            if ($app.uploadImage) {
                API.sendInvitePhoto(D.params, D.userId)
                    .catch((err) => {
                        throw err;
                    })
                    .then((args) => {
                        this.$message({
                            message: 'Invite photo message sent',
                            type: 'success'
                        });
                        return args;
                    });
            } else {
                API.sendInvite(D.params, D.userId)
                    .catch((err) => {
                        throw err;
                    })
                    .then((args) => {
                        this.$message({
                            message: 'Invite message sent',
                            type: 'success'
                        });
                        return args;
                    });
            }
        } else if (D.messageType === 'requestInvite') {
            D.params.requestSlot = D.messageSlot;
            if ($app.uploadImage) {
                API.sendRequestInvitePhoto(D.params, D.userId)
                    .catch((err) => {
                        this.clearInviteImageUpload();
                        throw err;
                    })
                    .then((args) => {
                        this.$message({
                            message: 'Request invite photo message sent',
                            type: 'success'
                        });
                        return args;
                    });
            } else {
                API.sendRequestInvite(D.params, D.userId)
                    .catch((err) => {
                        throw err;
                    })
                    .then((args) => {
                        this.$message({
                            message: 'Request invite message sent',
                            type: 'success'
                        });
                        return args;
                    });
            }
        }
        this.sendInviteDialogVisible = false;
        this.sendInviteRequestDialogVisible = false;
        this.sendInviteConfirmDialog.visible = false;
    };

    // #endregion
    // #region | App: Invite Request Message Dialog

    $app.data.sendInviteRequestDialogVisible = false;

    $app.methods.cancelSendInviteRequest = function () {
        this.sendInviteRequestDialogVisible = false;
    };

    API.$on('LOGIN', function () {
        $app.sendInviteRequestDialogVisible = false;
        $app.showSendInviteConfirmDialog.visible = false;
    });

    $app.methods.showSendInviteRequestDialog = function (params, userId) {
        this.sendInviteDialog = {
            params,
            userId,
            messageType: 'requestInvite'
        };
        API.refreshInviteMessageTableData('request');
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.sendInviteRequestDialog.$el)
        );
        this.clearInviteImageUpload();
        this.sendInviteRequestDialogVisible = true;
    };

    // #endregion
    // #region | App: Friends List

    API.$on('LOGIN', function () {
        $app.friendsListTable.data = [];
    });

    $app.methods.selectFriendsListRow = function (val) {
        if (val === null) {
            return;
        }
        if (!val.id) {
            this.lookupUser(val);
            return;
        }
        this.showUserDialog(val.id);
    };

    $app.data.friendsListSearch = '';
    $app.data.friendsListSearchFilterVIP = false;
    $app.data.friendsListSearchFilters = [];
    $app.data.friendsListSelectAllCheckbox = false;
    $app.data.friendsListBulkUnfriendMode = false;

    $app.methods.showBulkUnfriendSelectionConfirm = function () {
        var elementsTicked = 0;
        for (var ctx of this.friendsListTable.data) {
            if (ctx.$selected) {
                elementsTicked++;
            }
        }
        if (elementsTicked === 0) {
            return;
        }
        this.$confirm(
            `Are you sure you want to delete ${elementsTicked} friends?
            This can negatively affect your trust rank,
            This action cannot be undone.`,
            `Delete ${elementsTicked} friends?`,
            {
                confirmButtonText: 'Confirm',
                cancelButtonText: 'Cancel',
                type: 'info',
                callback: (action) => {
                    if (action === 'confirm') {
                        this.bulkUnfriendSelection();
                    }
                }
            }
        );
    };

    $app.methods.bulkUnfriendSelection = function () {
        for (var ctx of this.friendsListTable.data) {
            if (ctx.$selected) {
                API.deleteFriend({
                    userId: ctx.id
                });
            }
        }
    };

    // $app.methods.showBulkUnfriendAllConfirm = function () {
    //     this.$confirm(
    //         `Are you sure you want to delete all your friends?
    //         This can negatively affect your trust rank,
    //         This action cannot be undone.`,
    //         'Delete all friends?',
    //         {
    //             confirmButtonText: 'Confirm',
    //             cancelButtonText: 'Cancel',
    //             type: 'info',
    //             callback: (action) => {
    //                 if (action === 'confirm') {
    //                     this.bulkUnfriendAll();
    //                 }
    //             }
    //         }
    //     );
    // };

    // $app.methods.bulkUnfriendAll = function () {
    //     for (var ctx of this.friendsListTable.data) {
    //         API.deleteFriend({
    //             userId: ctx.id
    //         });
    //     }
    // };

    $app.methods.friendsListSearchChange = function () {
        this.friendsListTable.data = [];
        var filters = [...this.friendsListSearchFilters];
        if (filters.length === 0) {
            filters = ['Display Name', 'Rank', 'Status', 'Bio', 'Memo'];
        }
        var results = [];
        if (this.friendsListSearch) {
            var query = this.friendsListSearch.toUpperCase();
        }
        for (var ctx of this.friends.values()) {
            if (typeof ctx.ref === 'undefined') {
                continue;
            }
            if (typeof ctx.$selected === 'undefined') {
                ctx.$selected = false;
            }
            if (this.friendsListSearchFilterVIP && !ctx.isVIP) {
                continue;
            }
            if (query && filters) {
                var match = false;
                if (
                    !match &&
                    filters.includes('Display Name') &&
                    ctx.ref.displayName
                ) {
                    match = String(ctx.ref.displayName)
                        .toUpperCase()
                        .includes(query);
                }
                if (!match && filters.includes('Memo') && ctx.memo) {
                    match = String(ctx.memo).toUpperCase().includes(query);
                }
                if (!match && filters.includes('Bio') && ctx.ref.bio) {
                    match = String(ctx.ref.bio).toUpperCase().includes(query);
                }
                if (
                    !match &&
                    filters.includes('Status') &&
                    ctx.ref.statusDescription
                ) {
                    match = String(ctx.ref.statusDescription)
                        .toUpperCase()
                        .includes(query);
                }
                if (!match && filters.includes('Rank') && ctx.ref.$friendNum) {
                    match = String(ctx.ref.$trustLevel)
                        .toUpperCase()
                        .includes(query);
                }
                if (!match) {
                    continue;
                }
            }
            ctx.ref.$friendNum = ctx.no;
            results.push(ctx.ref);
        }
        this.getAllUserStats();
        this.friendsListTable.data = results;
    };

    $app.methods.getAllUserStats = function () {
        var userIds = [];
        var displayNames = [];
        for (var ctx of this.friends.values()) {
            userIds.push(ctx.id);
            if (ctx.ref?.displayName) {
                displayNames.push(ctx.ref.displayName);
            }
        }

        database.getAllUserStats(userIds, displayNames).then((data) => {
            var friendListMap = new Map();
            for (var item of data) {
                if (!item.userId) {
                    // find userId from previous data with matching displayName
                    for (var ref of data) {
                        if (
                            ref.displayName === item.displayName &&
                            ref.userId
                        ) {
                            item.userId = ref.userId;
                        }
                    }
                    // if still no userId, find userId from friends list
                    if (!item.userId) {
                        for (var ref of this.friends.values()) {
                            if (
                                ref?.ref?.id &&
                                ref.ref.displayName === item.displayName
                            ) {
                                item.userId = ref.id;
                            }
                        }
                    }
                    // if still no userId, skip
                    if (!item.userId) {
                        continue;
                    }
                }

                var friend = friendListMap.get(item.userId);
                if (!friend) {
                    friendListMap.set(item.userId, item);
                    continue;
                }
                friend.timeSpent += item.timeSpent;
                friend.joinCount += item.joinCount;
                friend.displayName = item.displayName;
                friendListMap.set(item.userId, friend);
            }
            for (var item of friendListMap.values()) {
                var ref = this.friends.get(item.userId);
                if (ref?.ref) {
                    ref.ref.$joinCount = item.joinCount;
                    ref.ref.$lastSeen = item.created_at;
                    ref.ref.$timeSpent = item.timeSpent;
                }
            }
        });
    };

    $app.methods.getUserStats = async function (ctx) {
        var ref = await database.getUserStats(ctx);
        /* eslint-disable require-atomic-updates */
        ctx.$joinCount = ref.joinCount;
        ctx.$lastSeen = ref.created_at;
        ctx.$timeSpent = ref.timeSpent;
        /* eslint-enable require-atomic-updates */
    };

    $app.watch.friendsListSearch = $app.methods.friendsListSearchChange;
    $app.data.friendsListLoading = false;
    $app.data.friendsListLoadingProgress = '';

    $app.methods.friendsListLoadUsers = async function () {
        this.friendsListLoading = true;
        var i = 0;
        var toFetch = [];
        for (var ctx of this.friends.values()) {
            if (ctx.ref && !ctx.ref.date_joined) {
                toFetch.push(ctx.id);
            }
        }
        var length = toFetch.length;
        for (var userId of toFetch) {
            if (!this.friendsListLoading) {
                this.friendsListLoadingProgress = '';
                return;
            }
            i++;
            this.friendsListLoadingProgress = `${i}/${length}`;
            await API.getUser({
                userId
            });
        }
        this.friendsListLoadingProgress = '';
        this.friendsListLoading = false;
    };

    $app.methods.sortAlphabetically = function (a, b, field) {
        return a[field].toLowerCase().localeCompare(b[field].toLowerCase());
    };

    $app.methods.sortLanguages = function (a, b) {
        var sortedA = [];
        var sortedB = [];
        a.$languages.forEach((item) => {
            sortedA.push(item.value);
        });
        b.$languages.forEach((item) => {
            sortedB.push(item.value);
        });
        sortedA.sort();
        sortedB.sort();
        return JSON.stringify(sortedA).localeCompare(JSON.stringify(sortedB));
    };

    $app.methods.genMd5 = async function (file) {
        var response = await AppApi.MD5File(file);
        return response;
    };

    $app.methods.genSig = async function (file) {
        var response = await AppApi.SignFile(file);
        return response;
    };

    $app.methods.genLength = async function (file) {
        var response = await AppApi.FileLength(file);
        return response;
    };

    // Upload avatar image

    $app.methods.onFileChangeAvatarImage = function (e) {
        var clearFile = function () {
            if (document.querySelector('#AvatarImageUploadButton')) {
                document.querySelector('#AvatarImageUploadButton').value = '';
            }
        };
        var files = e.target.files || e.dataTransfer.files;
        if (
            !files.length ||
            !this.avatarDialog.visible ||
            this.avatarDialog.loading
        ) {
            clearFile();
            return;
        }
        if (files[0].size >= 10000000) {
            // 10MB
            $app.$message({
                message: 'File size too large',
                type: 'error'
            });
            clearFile();
            return;
        }
        if (!files[0].type.match(/image.png/)) {
            $app.$message({
                message: "File isn't a png",
                type: 'error'
            });
            clearFile();
            return;
        }
        this.avatarDialog.loading = true;
        this.changeAvatarImageDialogLoading = true;
        var r = new FileReader();
        r.onload = async function (file) {
            var base64File = btoa(r.result);
            var fileMd5 = await $app.genMd5(base64File);
            var fileSizeInBytes = parseInt(file.total, 10);
            var base64SignatureFile = await $app.genSig(base64File);
            var signatureMd5 = await $app.genMd5(base64SignatureFile);
            var signatureSizeInBytes = parseInt(
                await $app.genLength(base64SignatureFile),
                10
            );
            var avatarId = $app.avatarDialog.id;
            var { imageUrl } = $app.avatarDialog.ref;
            var fileId = extractFileId(imageUrl);
            if (!fileId) {
                $app.$message({
                    message: 'Current avatar image invalid',
                    type: 'error'
                });
                clearFile();
                return;
            }
            $app.avatarImage = {
                base64File,
                fileMd5,
                base64SignatureFile,
                signatureMd5,
                fileId,
                avatarId
            };
            var params = {
                fileMd5,
                fileSizeInBytes,
                signatureMd5,
                signatureSizeInBytes
            };
            API.uploadAvatarImage(params, fileId);
        };
        r.readAsBinaryString(files[0]);
        clearFile();
    };

    API.uploadAvatarImage = async function (params, fileId) {
        try {
            return await this.call(`file/${fileId}`, {
                method: 'POST',
                params
            }).then((json) => {
                var args = {
                    json,
                    params,
                    fileId
                };
                this.$emit('AVATARIMAGE:INIT', args);
                return args;
            });
        } catch (err) {
            console.error(err);
            this.uploadAvatarFailCleanup(fileId);
        }
        return void 0;
    };

    API.uploadAvatarFailCleanup = async function (fileId) {
        var json = await this.call(`file/${fileId}`, {
            method: 'GET'
        });
        var fileId = json.id;
        var fileVersion = json.versions[json.versions.length - 1].version;
        this.call(`file/${fileId}/${fileVersion}/signature/finish`, {
            method: 'PUT'
        });
        this.call(`file/${fileId}/${fileVersion}/file/finish`, {
            method: 'PUT'
        });
        $app.avatarDialog.loading = false;
        $app.changeAvatarImageDialogLoading = false;
    };

    API.$on('AVATARIMAGE:INIT', function (args) {
        var fileId = args.json.id;
        var fileVersion =
            args.json.versions[args.json.versions.length - 1].version;
        var params = {
            fileId,
            fileVersion
        };
        this.uploadAvatarImageFileStart(params);
    });

    API.uploadAvatarImageFileStart = async function (params) {
        try {
            return await this.call(
                `file/${params.fileId}/${params.fileVersion}/file/start`,
                {
                    method: 'PUT'
                }
            ).then((json) => {
                var args = {
                    json,
                    params
                };
                this.$emit('AVATARIMAGE:FILESTART', args);
                return args;
            });
        } catch (err) {
            console.error(err);
            this.uploadAvatarFailCleanup(params.fileId);
        }
        return void 0;
    };

    API.$on('AVATARIMAGE:FILESTART', function (args) {
        var { url } = args.json;
        var { fileId, fileVersion } = args.params;
        var params = {
            url,
            fileId,
            fileVersion
        };
        this.uploadAvatarImageFileAWS(params);
    });

    API.uploadAvatarImageFileAWS = function (params) {
        return webApiService
            .execute({
                url: params.url,
                uploadFilePUT: true,
                fileData: $app.avatarImage.base64File,
                fileMIME: 'image/png',
                headers: {
                    'Content-MD5': $app.avatarImage.fileMd5
                }
            })
            .then((json) => {
                if (json.status !== 200) {
                    $app.avatarDialog.loading = false;
                    $app.changeAvatarImageDialogLoading = false;
                    this.$throw('Avatar image upload failed', json);
                }
                var args = {
                    json,
                    params
                };
                this.$emit('AVATARIMAGE:FILEAWS', args);
                return args;
            });
    };

    API.$on('AVATARIMAGE:FILEAWS', function (args) {
        var { fileId, fileVersion } = args.params;
        var params = {
            fileId,
            fileVersion
        };
        this.uploadAvatarImageFileFinish(params);
    });

    API.uploadAvatarImageFileFinish = function (params) {
        return this.call(
            `file/${params.fileId}/${params.fileVersion}/file/finish`,
            {
                method: 'PUT',
                params: {
                    maxParts: 0,
                    nextPartNumber: 0
                }
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATARIMAGE:FILEFINISH', args);
            return args;
        });
    };

    API.$on('AVATARIMAGE:FILEFINISH', function (args) {
        var { fileId, fileVersion } = args.params;
        var params = {
            fileId,
            fileVersion
        };
        this.uploadAvatarImageSigStart(params);
    });

    API.uploadAvatarImageSigStart = async function (params) {
        try {
            return await this.call(
                `file/${params.fileId}/${params.fileVersion}/signature/start`,
                {
                    method: 'PUT'
                }
            ).then((json) => {
                var args = {
                    json,
                    params
                };
                this.$emit('AVATARIMAGE:SIGSTART', args);
                return args;
            });
        } catch (err) {
            console.error(err);
            this.uploadAvatarFailCleanup(params.fileId);
        }
        return void 0;
    };

    API.$on('AVATARIMAGE:SIGSTART', function (args) {
        var { url } = args.json;
        var { fileId, fileVersion } = args.params;
        var params = {
            url,
            fileId,
            fileVersion
        };
        this.uploadAvatarImageSigAWS(params);
    });

    API.uploadAvatarImageSigAWS = function (params) {
        return webApiService
            .execute({
                url: params.url,
                uploadFilePUT: true,
                fileData: $app.avatarImage.base64SignatureFile,
                fileMIME: 'application/x-rsync-signature',
                headers: {
                    'Content-MD5': $app.avatarImage.signatureMd5
                }
            })
            .then((json) => {
                if (json.status !== 200) {
                    $app.avatarDialog.loading = false;
                    $app.changeAvatarImageDialogLoading = false;
                    this.$throw('Avatar image upload failed', json);
                }
                var args = {
                    json,
                    params
                };
                this.$emit('AVATARIMAGE:SIGAWS', args);
                return args;
            });
    };

    API.$on('AVATARIMAGE:SIGAWS', function (args) {
        var { fileId, fileVersion } = args.params;
        var params = {
            fileId,
            fileVersion
        };
        this.uploadAvatarImageSigFinish(params);
    });

    API.uploadAvatarImageSigFinish = function (params) {
        return this.call(
            `file/${params.fileId}/${params.fileVersion}/signature/finish`,
            {
                method: 'PUT',
                params: {
                    maxParts: 0,
                    nextPartNumber: 0
                }
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATARIMAGE:SIGFINISH', args);
            return args;
        });
    };

    API.$on('AVATARIMAGE:SIGFINISH', function (args) {
        var { fileId, fileVersion } = args.params;
        var parmas = {
            id: $app.avatarImage.avatarId,
            imageUrl: `${API.endpointDomain}/file/${fileId}/${fileVersion}/file`
        };
        this.setAvatarImage(parmas);
    });

    API.setAvatarImage = function (params) {
        return this.call(`avatars/${params.id}`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATARIMAGE:SET', args);
            this.$emit('AVATAR', args);
            return args;
        });
    };

    // Upload world image

    $app.methods.onFileChangeWorldImage = function (e) {
        var clearFile = function () {
            if (document.querySelector('#WorldImageUploadButton')) {
                document.querySelector('#WorldImageUploadButton').value = '';
            }
        };
        var files = e.target.files || e.dataTransfer.files;
        if (
            !files.length ||
            !this.worldDialog.visible ||
            this.worldDialog.loading
        ) {
            clearFile();
            return;
        }
        if (files[0].size >= 10000000) {
            // 10MB
            $app.$message({
                message: 'File size too large',
                type: 'error'
            });
            clearFile();
            return;
        }
        if (!files[0].type.match(/image.png/)) {
            $app.$message({
                message: "File isn't a png",
                type: 'error'
            });
            clearFile();
            return;
        }
        this.worldDialog.loading = true;
        this.changeWorldImageDialogLoading = true;
        var r = new FileReader();
        r.onload = async function (file) {
            var base64File = btoa(r.result);
            var fileMd5 = await $app.genMd5(base64File);
            var fileSizeInBytes = parseInt(file.total, 10);
            var base64SignatureFile = await $app.genSig(base64File);
            var signatureMd5 = await $app.genMd5(base64SignatureFile);
            var signatureSizeInBytes = parseInt(
                await $app.genLength(base64SignatureFile),
                10
            );
            var worldId = $app.worldDialog.id;
            var { imageUrl } = $app.worldDialog.ref;
            var fileId = extractFileId(imageUrl);
            if (!fileId) {
                $app.$message({
                    message: 'Current world image invalid',
                    type: 'error'
                });
                clearFile();
                return;
            }
            $app.worldImage = {
                base64File,
                fileMd5,
                base64SignatureFile,
                signatureMd5,
                fileId,
                worldId
            };
            var params = {
                fileMd5,
                fileSizeInBytes,
                signatureMd5,
                signatureSizeInBytes
            };
            API.uploadWorldImage(params, fileId);
        };
        r.readAsBinaryString(files[0]);
        clearFile();
    };

    API.uploadWorldImage = async function (params, fileId) {
        try {
            return await this.call(`file/${fileId}`, {
                method: 'POST',
                params
            }).then((json) => {
                var args = {
                    json,
                    params,
                    fileId
                };
                this.$emit('WORLDIMAGE:INIT', args);
                return args;
            });
        } catch (err) {
            console.error(err);
            this.uploadWorldFailCleanup(fileId);
        }
        return void 0;
    };

    API.uploadWorldFailCleanup = async function (fileId) {
        var json = await this.call(`file/${fileId}`, {
            method: 'GET'
        });
        var fileId = json.id;
        var fileVersion = json.versions[json.versions.length - 1].version;
        this.call(`file/${fileId}/${fileVersion}/signature/finish`, {
            method: 'PUT'
        });
        this.call(`file/${fileId}/${fileVersion}/file/finish`, {
            method: 'PUT'
        });
        $app.worldDialog.loading = false;
        $app.changeWorldImageDialogLoading = false;
    };

    API.$on('WORLDIMAGE:INIT', function (args) {
        var fileId = args.json.id;
        var fileVersion =
            args.json.versions[args.json.versions.length - 1].version;
        var params = {
            fileId,
            fileVersion
        };
        this.uploadWorldImageFileStart(params);
    });

    API.uploadWorldImageFileStart = async function (params) {
        try {
            return await this.call(
                `file/${params.fileId}/${params.fileVersion}/file/start`,
                {
                    method: 'PUT'
                }
            ).then((json) => {
                var args = {
                    json,
                    params
                };
                this.$emit('WORLDIMAGE:FILESTART', args);
                return args;
            });
        } catch (err) {
            console.error(err);
            this.uploadWorldFailCleanup(params.fileId);
        }
        return void 0;
    };

    API.$on('WORLDIMAGE:FILESTART', function (args) {
        var { url } = args.json;
        var { fileId, fileVersion } = args.params;
        var params = {
            url,
            fileId,
            fileVersion
        };
        this.uploadWorldImageFileAWS(params);
    });

    API.uploadWorldImageFileAWS = function (params) {
        return webApiService
            .execute({
                url: params.url,
                uploadFilePUT: true,
                fileData: $app.worldImage.base64File,
                fileMIME: 'image/png',
                headers: {
                    'Content-MD5': $app.worldImage.fileMd5
                }
            })
            .then((json) => {
                if (json.status !== 200) {
                    $app.worldDialog.loading = false;
                    $app.changeWorldImageDialogLoading = false;
                    this.$throw('World image upload failed', json);
                }
                var args = {
                    json,
                    params
                };
                this.$emit('WORLDIMAGE:FILEAWS', args);
                return args;
            });
    };

    API.$on('WORLDIMAGE:FILEAWS', function (args) {
        var { fileId, fileVersion } = args.params;
        var params = {
            fileId,
            fileVersion
        };
        this.uploadWorldImageFileFinish(params);
    });

    API.uploadWorldImageFileFinish = function (params) {
        return this.call(
            `file/${params.fileId}/${params.fileVersion}/file/finish`,
            {
                method: 'PUT',
                params: {
                    maxParts: 0,
                    nextPartNumber: 0
                }
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLDIMAGE:FILEFINISH', args);
            return args;
        });
    };

    API.$on('WORLDIMAGE:FILEFINISH', function (args) {
        var { fileId, fileVersion } = args.params;
        var params = {
            fileId,
            fileVersion
        };
        this.uploadWorldImageSigStart(params);
    });

    API.uploadWorldImageSigStart = async function (params) {
        try {
            return await this.call(
                `file/${params.fileId}/${params.fileVersion}/signature/start`,
                {
                    method: 'PUT'
                }
            ).then((json) => {
                var args = {
                    json,
                    params
                };
                this.$emit('WORLDIMAGE:SIGSTART', args);
                return args;
            });
        } catch (err) {
            console.error(err);
            this.uploadWorldFailCleanup(params.fileId);
        }
        return void 0;
    };

    API.$on('WORLDIMAGE:SIGSTART', function (args) {
        var { url } = args.json;
        var { fileId, fileVersion } = args.params;
        var params = {
            url,
            fileId,
            fileVersion
        };
        this.uploadWorldImageSigAWS(params);
    });

    API.uploadWorldImageSigAWS = function (params) {
        return webApiService
            .execute({
                url: params.url,
                uploadFilePUT: true,
                fileData: $app.worldImage.base64SignatureFile,
                fileMIME: 'application/x-rsync-signature',
                headers: {
                    'Content-MD5': $app.worldImage.signatureMd5
                }
            })
            .then((json) => {
                if (json.status !== 200) {
                    $app.worldDialog.loading = false;
                    $app.changeWorldImageDialogLoading = false;
                    this.$throw('World image upload failed', json);
                }
                var args = {
                    json,
                    params
                };
                this.$emit('WORLDIMAGE:SIGAWS', args);
                return args;
            });
    };

    API.$on('WORLDIMAGE:SIGAWS', function (args) {
        var { fileId, fileVersion } = args.params;
        var params = {
            fileId,
            fileVersion
        };
        this.uploadWorldImageSigFinish(params);
    });

    API.uploadWorldImageSigFinish = function (params) {
        return this.call(
            `file/${params.fileId}/${params.fileVersion}/signature/finish`,
            {
                method: 'PUT',
                params: {
                    maxParts: 0,
                    nextPartNumber: 0
                }
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLDIMAGE:SIGFINISH', args);
            return args;
        });
    };

    API.$on('WORLDIMAGE:SIGFINISH', function (args) {
        var { fileId, fileVersion } = args.params;
        var parmas = {
            id: $app.worldImage.worldId,
            imageUrl: `${API.endpointDomain}/file/${fileId}/${fileVersion}/file`
        };
        this.setWorldImage(parmas);
    });

    API.setWorldImage = function (params) {
        return this.call(`worlds/${params.id}`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLDIMAGE:SET', args);
            this.$emit('WORLD', args);
            return args;
        });
    };

    API.$on('AVATARIMAGE:SET', function (args) {
        $app.avatarDialog.loading = false;
        $app.changeAvatarImageDialogLoading = false;
        if (args.json.imageUrl === args.params.imageUrl) {
            $app.$message({
                message: 'Avatar image changed',
                type: 'success'
            });
            $app.displayPreviousImages('Avatar', 'Change');
        } else {
            this.$throw(0, 'Avatar image change failed');
        }
    });

    API.setWorldImage = function (params) {
        return this.call(`worlds/${params.id}`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLDIMAGE:SET', args);
            this.$emit('WORLD', args);
            return args;
        });
    };

    API.$on('WORLDIMAGE:SET', function (args) {
        $app.worldDialog.loading = false;
        $app.changeWorldImageDialogLoading = false;
        if (args.json.imageUrl === args.params.imageUrl) {
            $app.$message({
                message: 'World image changed',
                type: 'success'
            });
            $app.displayPreviousImages('World', 'Change');
        } else {
            this.$throw(0, 'World image change failed');
        }
    });

    // Set avatar/world image

    $app.methods.displayPreviousImages = function (type, command) {
        this.previousImagesTableFileId = '';
        this.previousImagesTable = [];
        var imageUrl = '';
        if (type === 'Avatar') {
            var { imageUrl } = this.avatarDialog.ref;
        } else if (type === 'World') {
            var { imageUrl } = this.worldDialog.ref;
        } else if (type === 'User') {
            imageUrl = this.userDialog.ref.currentAvatarImageUrl;
        }
        var fileId = extractFileId(imageUrl);
        if (!fileId) {
            return;
        }
        var params = {
            fileId
        };
        if (command === 'Display') {
            this.previousImagesDialogVisible = true;
            this.$nextTick(() =>
                adjustDialogZ(this.$refs.previousImagesDialog.$el)
            );
        }
        if (type === 'Avatar') {
            if (command === 'Change') {
                this.changeAvatarImageDialogVisible = true;
                this.$nextTick(() =>
                    adjustDialogZ(this.$refs.changeAvatarImageDialog.$el)
                );
            }
            API.getAvatarImages(params).then((args) => {
                this.previousImagesTableFileId = args.json.id;
                var images = [];
                args.json.versions.forEach((item) => {
                    if (!item.deleted) {
                        images.unshift(item);
                    }
                });
                this.checkPreviousImageAvailable(images);
            });
        } else if (type === 'World') {
            if (command === 'Change') {
                this.changeWorldImageDialogVisible = true;
                this.$nextTick(() =>
                    adjustDialogZ(this.$refs.changeWorldImageDialog.$el)
                );
            }
            API.getWorldImages(params).then((args) => {
                this.previousImagesTableFileId = args.json.id;
                var images = [];
                args.json.versions.forEach((item) => {
                    if (!item.deleted) {
                        images.unshift(item);
                    }
                });
                this.checkPreviousImageAvailable(images);
            });
        } else if (type === 'User') {
            API.getAvatarImages(params).then((args) => {
                this.previousImagesTableFileId = args.json.id;
                var images = [];
                args.json.versions.forEach((item) => {
                    if (!item.deleted) {
                        images.unshift(item);
                    }
                });
                this.checkPreviousImageAvailable(images);
            });
        }
    };

    $app.methods.checkPreviousImageAvailable = async function (images) {
        this.previousImagesTable = [];
        for (var image of images) {
            if (image.file && image.file.url) {
                var response = await fetch(image.file.url, {
                    method: 'HEAD',
                    redirect: 'follow'
                }).catch((error) => {
                    console.log(error);
                });
                if (response.status === 200) {
                    this.previousImagesTable.push(image);
                }
            }
        }
    };

    $app.data.previousImagesDialogVisible = false;
    $app.data.changeAvatarImageDialogVisible = false;
    $app.data.changeAvatarImageDialogLoading = false;
    $app.data.changeWorldImageDialogVisible = false;
    $app.data.changeWorldImageDialogLoading = false;
    $app.data.previousImagesTable = [];
    $app.data.previousImagesFileId = '';

    API.$on('LOGIN', function () {
        $app.previousImagesTable = [];
        $app.previousImagesDialogVisible = false;
    });

    API.getAvatarImages = function (params) {
        return this.call(`file/${params.fileId}`, {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('AVATARIMAGE:GET', args);
            return args;
        });
    };

    API.getWorldImages = function (params) {
        return this.call(`file/${params.fileId}`, {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('WORLDIMAGE:GET', args);
            return args;
        });
    };

    API.$on('AVATARIMAGE:GET', function (args) {
        $app.storeAvatarImage(args);
    });

    $app.methods.storeAvatarImage = function (args) {
        var refCreatedAt = args.json.versions[0];
        var fileCreatedAt = refCreatedAt.created_at;
        var fileId = args.params.fileId;
        var avatarName = '';
        var imageName = args.json.name;
        var avatarNameRegex = /Avatar - (.*) - Image -/g.exec(imageName);
        if (avatarNameRegex) {
            avatarName = this.replaceBioSymbols(avatarNameRegex[1]);
        }
        var ownerId = args.json.ownerId;
        var avatarInfo = {
            ownerId,
            avatarName,
            fileCreatedAt
        };
        API.cachedAvatarNames.set(fileId, avatarInfo);
        return avatarInfo;
    };

    $app.methods.setAvatarImage = function (image) {
        this.changeAvatarImageDialogLoading = true;
        var parmas = {
            id: this.avatarDialog.id,
            imageUrl: `${API.endpointDomain}/file/${this.previousImagesTableFileId}/${image.version}/file`
        };
        API.setAvatarImage(parmas).finally(() => {
            this.changeAvatarImageDialogLoading = false;
            this.changeAvatarImageDialogVisible = false;
        });
    };

    $app.methods.uploadAvatarImage = function () {
        document.getElementById('AvatarImageUploadButton').click();
    };

    $app.methods.deleteAvatarImage = function () {
        this.changeAvatarImageDialogLoading = true;
        var parmas = {
            fileId: this.previousImagesTableFileId,
            version: this.previousImagesTable[0].version
        };
        API.deleteFileVersion(parmas)
            .then((args) => {
                this.previousImagesTableFileId = args.json.id;
                var images = [];
                args.json.versions.forEach((item) => {
                    if (!item.deleted) {
                        images.unshift(item);
                    }
                });
                this.checkPreviousImageAvailable(images);
            })
            .finally(() => {
                this.changeAvatarImageDialogLoading = false;
            });
    };

    $app.methods.setWorldImage = function (image) {
        this.changeWorldImageDialogLoading = true;
        var parmas = {
            id: this.worldDialog.id,
            imageUrl: `${API.endpointDomain}/file/${this.previousImagesTableFileId}/${image.version}/file`
        };
        API.setWorldImage(parmas).finally(() => {
            this.changeWorldImageDialogLoading = false;
            this.changeWorldImageDialogVisible = false;
        });
    };

    $app.methods.uploadWorldImage = function () {
        document.getElementById('WorldImageUploadButton').click();
    };

    $app.methods.deleteWorldImage = function () {
        this.changeWorldImageDialogLoading = true;
        var parmas = {
            fileId: this.previousImagesTableFileId,
            version: this.previousImagesTable[0].version
        };
        API.deleteFileVersion(parmas)
            .then((args) => {
                this.previousImagesTableFileId = args.json.id;
                var images = [];
                args.json.versions.forEach((item) => {
                    if (!item.deleted) {
                        images.unshift(item);
                    }
                });
                this.checkPreviousImageAvailable(images);
            })
            .finally(() => {
                this.changeWorldImageDialogLoading = false;
            });
    };

    $app.methods.compareCurrentImage = function (image) {
        if (
            `${API.endpointDomain}/file/${this.previousImagesTableFileId}/${image.version}/file` ===
            this.avatarDialog.ref.imageUrl
        ) {
            return true;
        }
        return false;
    };

    // Avatar names

    API.cachedAvatarNames = new Map();

    $app.methods.getAvatarName = async function (imageUrl) {
        var fileId = extractFileId(imageUrl);
        if (!fileId) {
            return {
                ownerId: '',
                avatarName: '-'
            };
        }
        if (API.cachedAvatarNames.has(fileId)) {
            return API.cachedAvatarNames.get(fileId);
        }
        var args = await API.getAvatarImages({ fileId });
        return this.storeAvatarImage(args);
    };

    $app.data.discordNamesDialogVisible = false;
    $app.data.discordNamesContent = '';

    $app.methods.showDiscordNamesDialog = function () {
        var { friends } = API.currentUser;
        if (Array.isArray(friends) === false) {
            return;
        }
        var lines = ['DisplayName,DiscordName'];
        var _ = function (str) {
            if (/[\x00-\x1f,"]/.test(str) === true) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        for (var userId of friends) {
            var { ref } = this.friends.get(userId);
            var discord = '';
            if (typeof ref === 'undefined') {
                continue;
            }
            var name = ref.displayName;
            if (ref.statusDescription) {
                var statusRegex = /(?:discord|dc|dis)(?: |=|:|˸|;)(.*)/gi.exec(
                    ref.statusDescription
                );
                if (statusRegex) {
                    discord = statusRegex[1];
                }
            }
            if (!discord && ref.bio) {
                var bioRegex = /(?:discord|dc|dis)(?: |=|:|˸|;)(.*)/gi.exec(
                    ref.bio
                );
                if (bioRegex) {
                    discord = bioRegex[1];
                }
            }
            if (!discord) {
                continue;
            }
            discord = discord.trim();
            lines.push(`${_(name)},${_(discord)}`);
        }
        this.discordNamesContent = lines.join('\n');
        this.discordNamesDialogVisible = true;
    };

    // userDialog world/avatar tab click

    $app.data.userDialogLastActiveTab = '';
    $app.data.userDialogLastAvatar = '';
    $app.data.userDialogLastWorld = '';
    $app.data.userDialogLastFavoriteWorld = '';
    $app.data.userDialogLastGroup = '';

    $app.methods.userDialogTabClick = function (obj) {
        var userId = this.userDialog.id;
        if (this.userDialogLastActiveTab === obj.label) {
            return;
        }
        if (obj.label === $t('dialog.user.groups.header')) {
            if (this.userDialogLastGroup !== userId) {
                this.userDialogLastGroup = userId;
                this.getUserGroups(userId);
            }
        } else if (obj.label === $t('dialog.user.avatars.header')) {
            this.setUserDialogAvatars(userId);
            if (this.userDialogLastAvatar !== userId) {
                this.userDialogLastAvatar = userId;
                if (
                    userId === API.currentUser.id &&
                    this.userDialog.avatars.length === 0
                ) {
                    this.refreshUserDialogAvatars();
                } else {
                    this.setUserDialogAvatarsRemote(userId);
                }
            }
        } else if (obj.label === $t('dialog.user.worlds.header')) {
            this.setUserDialogWorlds(userId);
            if (this.userDialogLastWorld !== userId) {
                this.userDialogLastWorld = userId;
                this.refreshUserDialogWorlds();
            }
        } else if (obj.label === $t('dialog.user.favorite_worlds.header')) {
            if (this.userDialogLastFavoriteWorld !== userId) {
                this.userDialogLastFavoriteWorld = userId;
                this.getUserFavoriteWorlds(userId);
            }
        } else if (obj.label === $t('dialog.user.json.header')) {
            this.refreshUserDialogTreeData();
        }
        this.userDialogLastActiveTab = obj.label;
    };

    // VRChat Config JSON

    $app.data.VRChatConfigFile = {};
    $app.data.VRChatConfigList = {};

    $app.methods.readVRChatConfigFile = async function () {
        this.VRChatConfigFile = {};
        var config = await AppApi.ReadConfigFile();
        if (config) {
            try {
                this.VRChatConfigFile = JSON.parse(config);
            } catch {
                this.$message({
                    message: 'Invalid JSON in config.json',
                    type: 'error'
                });
                throw new Error('Invalid JSON in config.json');
            }
        }
    };

    $app.methods.WriteVRChatConfigFile = function () {
        var json = JSON.stringify(this.VRChatConfigFile, null, '\t');
        AppApi.WriteConfigFile(json);
    };

    $app.data.VRChatConfigDialog = {
        visible: false
    };

    API.$on('LOGIN', function () {
        $app.VRChatConfigDialog.visible = false;
    });

    $app.methods.showVRChatConfig = async function () {
        this.VRChatConfigList = {
            cache_size: {
                name: $t('dialog.config_json.max_cache_size'),
                default: '20',
                type: 'number',
                min: 20
            },
            cache_expiry_delay: {
                name: $t('dialog.config_json.cache_expiry_delay'),
                default: '30',
                type: 'number',
                min: 30
            },
            cache_directory: {
                name: $t('dialog.config_json.cache_directory'),
                default: '%AppData%\\..\\LocalLow\\VRChat\\vrchat'
            },
            picture_output_folder: {
                name: $t('dialog.config_json.picture_directory'),
                // my pictures folder
                default: `%UserProfile%\\Pictures\\VRChat`
            },
            // dynamic_bone_max_affected_transform_count: {
            //     name: 'Dynamic Bones Limit Max Transforms (0 disable all transforms)',
            //     default: '32',
            //     type: 'number',
            //     min: 0
            // },
            // dynamic_bone_max_collider_check_count: {
            //     name: 'Dynamic Bones Limit Max Collider Collisions (0 disable all colliders)',
            //     default: '8',
            //     type: 'number',
            //     min: 0
            // },
            fpv_steadycam_fov: {
                name: $t('dialog.config_json.fpv_steadycam_fov'),
                default: '50',
                type: 'number',
                min: 30,
                max: 110
            }
        };
        await this.readVRChatConfigFile();
        this.$nextTick(() => adjustDialogZ(this.$refs.VRChatConfigDialog.$el));
        this.VRChatConfigDialog.visible = true;
        if (!this.VRChatUsedCacheSize) {
            this.getVRChatCacheSize();
        }
    };

    $app.methods.saveVRChatConfigFile = function () {
        for (var item in this.VRChatConfigFile) {
            if (item === 'picture_output_split_by_date') {
                // this one is default true, it's special
                if (this.VRChatConfigFile[item]) {
                    delete this.VRChatConfigFile[item];
                }
            } else if (this.VRChatConfigFile[item] === '') {
                delete this.VRChatConfigFile[item];
            } else if (
                typeof this.VRChatConfigFile[item] === 'boolean' &&
                this.VRChatConfigFile[item] === false
            ) {
                delete this.VRChatConfigFile[item];
            } else if (
                typeof this.VRChatConfigFile[item] === 'string' &&
                !isNaN(this.VRChatConfigFile[item])
            ) {
                this.VRChatConfigFile[item] = parseInt(
                    this.VRChatConfigFile[item],
                    10
                );
            }
        }
        this.VRChatConfigDialog.visible = false;
        this.WriteVRChatConfigFile();
    };

    $app.data.VRChatScreenshotResolutions = [
        { name: '1280x720 (720p)', width: 1280, height: 720 },
        { name: '1920x1080 (1080p Default)', width: '', height: '' },
        { name: '2560x1440 (1440p)', width: 2560, height: 1440 },
        { name: '3840x2160 (4K)', width: 3840, height: 2160 }
    ];

    $app.data.VRChatCameraResolutions = [
        { name: '1280x720 (720p)', width: 1280, height: 720 },
        { name: '1920x1080 (1080p Default)', width: '', height: '' },
        { name: '2560x1440 (1440p)', width: 2560, height: 1440 },
        { name: '3840x2160 (4K)', width: 3840, height: 2160 },
        { name: '7680x4320 (8K)', width: 7680, height: 4320 }
    ];

    $app.methods.getVRChatResolution = function (res) {
        switch (res) {
            case '1280x720':
                return '1280x720 (720p)';
            case '1920x1080':
                return '1920x1080 (1080p)';
            case '2560x1440':
                return '2560x1440 (2K)';
            case '3840x2160':
                return '3840x2160 (4K)';
            case '7680x4320':
                return '7680x4320 (8K)';
        }
        return `${res} (Custom)`;
    };

    $app.methods.getVRChatCameraResolution = function () {
        if (
            this.VRChatConfigFile.camera_res_height &&
            this.VRChatConfigFile.camera_res_width
        ) {
            var res = `${this.VRChatConfigFile.camera_res_width}x${this.VRChatConfigFile.camera_res_height}`;
            return this.getVRChatResolution(res);
        }
        return '1920x1080 (1080p)';
    };

    $app.methods.getVRChatScreenshotResolution = function () {
        if (
            this.VRChatConfigFile.screenshot_res_height &&
            this.VRChatConfigFile.screenshot_res_width
        ) {
            var res = `${this.VRChatConfigFile.screenshot_res_width}x${this.VRChatConfigFile.screenshot_res_height}`;
            return this.getVRChatResolution(res);
        }
        return '1920x1080 (1080p)';
    };

    $app.methods.setVRChatCameraResolution = function (res) {
        this.VRChatConfigFile.camera_res_height = res.height;
        this.VRChatConfigFile.camera_res_width = res.width;
    };

    $app.methods.setVRChatScreenshotResolution = function (res) {
        this.VRChatConfigFile.screenshot_res_height = res.height;
        this.VRChatConfigFile.screenshot_res_width = res.width;
    };

    // Auto Launch Shortcuts

    $app.methods.openShortcutFolder = function () {
        AppApi.OpenShortcutFolder();
    };

    $app.methods.updateAppLauncherSettings = async function () {
        await configRepository.setBool(
            'VRCX_enableAppLauncher',
            this.enableAppLauncher
        );
        await configRepository.setBool(
            'VRCX_enableAppLauncherAutoClose',
            this.enableAppLauncherAutoClose
        );
        await AppApi.SetAppLauncherSettings(
            this.enableAppLauncher,
            this.enableAppLauncherAutoClose
        );
    };

    // Screenshot Helper

    $app.methods.saveScreenshotHelper = async function () {
        await configRepository.setBool(
            'VRCX_screenshotHelper',
            this.screenshotHelper
        );
        await configRepository.setBool(
            'VRCX_screenshotHelperModifyFilename',
            this.screenshotHelperModifyFilename
        );
        await configRepository.setBool(
            'VRCX_screenshotHelperCopyToClipboard',
            this.screenshotHelperCopyToClipboard
        );
    };

    $app.methods.processScreenshot = async function (path) {
        var newPath = path;
        if (this.screenshotHelper) {
            var location = API.parseLocation(this.lastLocation.location);
            var metadata = {
                application: 'VRCX',
                version: 1,
                author: {
                    id: API.currentUser.id,
                    displayName: API.currentUser.displayName
                },
                world: {
                    name: this.lastLocation.name,
                    id: location.worldId,
                    instanceId: this.lastLocation.location
                },
                players: []
            };
            for (var user of this.lastLocation.playerList.values()) {
                metadata.players.push({
                    id: user.userId,
                    displayName: user.displayName
                });
            }
            newPath = await AppApi.AddScreenshotMetadata(
                path,
                JSON.stringify(metadata),
                location.worldId,
                this.screenshotHelperModifyFilename
            );
        }
        if (this.screenshotHelperCopyToClipboard) {
            await AppApi.CopyImageToClipboard(newPath);
        }
    };

    $app.methods.getAndDisplayScreenshot = function (
        path,
        needsCarouselFiles = true
    ) {
        AppApi.GetScreenshotMetadata(path).then((metadata) =>
            this.displayScreenshotMetadata(metadata, needsCarouselFiles)
        );
    };

    $app.methods.getAndDisplayLastScreenshot = function () {
        this.screenshotMetadataResetSearch();
        AppApi.GetLastScreenshot().then((path) =>
            this.getAndDisplayScreenshot(path)
        );
    };

    /**
     * Function receives an unmodified json string grabbed from the screenshot file
     * Error checking and and verification of data is done in .NET already; In the case that the data/file is invalid, a JSON object with the token "error" will be returned containing a description of the problem.
     * Example: {"error":"Invalid file selected. Please select a valid VRChat screenshot."}
     * See docs/screenshotMetadata.json for schema
     * @param {string} metadata - JSON string grabbed from PNG file
     * @param {string} needsCarouselFiles - Whether or not to get the last/next files for the carousel
     * @returns {void}
     */
    $app.methods.displayScreenshotMetadata = async function (
        json,
        needsCarouselFiles = true
    ) {
        var D = this.screenshotMetadataDialog;
        var metadata = JSON.parse(json);

        // Get extra data for display dialog like resolution, file size, etc
        D.loading = true;
        var extraData = await AppApi.GetExtraScreenshotData(
            metadata.sourceFile,
            needsCarouselFiles
        );
        D.loading = false;
        var extraDataObj = JSON.parse(extraData);
        Object.assign(metadata, extraDataObj);

        // console.log("Displaying screenshot metadata", json, "extra data", extraDataObj, "path", json.filePath)

        D.metadata = metadata;

        var regex = metadata.fileName.match(
            /VRChat_((\d{3,})x(\d{3,})_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(\d{1,})|(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(\d{3})_(\d{3,})x(\d{3,}))/
        );
        if (regex) {
            if (typeof regex[2] !== 'undefined' && regex[4].length === 4) {
                // old format
                // VRChat_3840x2160_2022-02-02_03-21-39.771
                var date = `${regex[4]}-${regex[5]}-${regex[6]}`;
                var time = `${regex[7]}:${regex[8]}:${regex[9]}`;
                D.metadata.dateTime = Date.parse(`${date} ${time}`);
                // D.metadata.resolution = `${regex[2]}x${regex[3]}`;
            } else if (
                typeof regex[11] !== 'undefined' &&
                regex[11].length === 4
            ) {
                // new format
                // VRChat_2023-02-16_10-39-25.274_3840x2160
                var date = `${regex[11]}-${regex[12]}-${regex[13]}`;
                var time = `${regex[14]}:${regex[15]}:${regex[16]}`;
                D.metadata.dateTime = Date.parse(`${date} ${time}`);
                // D.metadata.resolution = `${regex[18]}x${regex[19]}`;
            }
        }
        if (!D.metadata.dateTime) {
            D.metadata.dateTime = Date.parse(json.creationDate);
        }

        if (this.fullscreenImageDialog?.visible) {
            this.showFullscreenImageDialog(D.metadata.filePath);
        } else {
            this.openScreenshotMetadataDialog();
        }
    };

    $app.data.screenshotMetadataDialog = {
        visible: false,
        loading: false,
        search: '',
        searchType: 'Player Name',
        searchTypes: ['Player Name', 'Player ID', 'World  Name', 'World  ID'],
        metadata: {},
        isUploading: false
    };

    $app.methods.openScreenshotMetadataDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.screenshotMetadataDialog.$el)
        );
        var D = this.screenshotMetadataDialog;
        D.visible = true;
    };

    $app.methods.showScreenshotMetadataDialog = function () {
        var D = this.screenshotMetadataDialog;
        if (!D.metadata.filePath) {
            this.getAndDisplayLastScreenshot();
        }
        this.openScreenshotMetadataDialog();
    };

    $app.methods.screenshotMetadataResetSearch = function () {
        var D = this.screenshotMetadataDialog;

        D.search = '';
        D.searchIndex = null;
        D.searchResults = null;
    };

    $app.data.screenshotMetadataSearchInputs = 0;
    $app.methods.screenshotMetadataSearch = function () {
        var D = this.screenshotMetadataDialog;

        // Don't search if user is still typing
        this.screenshotMetadataSearchInputs++;
        let current = this.screenshotMetadataSearchInputs;
        setTimeout(() => {
            if (current !== this.screenshotMetadataSearchInputs) {
                return;
            }
            this.screenshotMetadataSearchInputs = 0;

            if (D.search === '') {
                this.screenshotMetadataResetSearch();
                if (D.metadata.filePath !== null) {
                    // Re-retrieve the current screenshot metadata and get previous/next files for regular carousel directory navigation
                    this.getAndDisplayScreenshot(D.metadata.filePath, true);
                }
                return;
            }

            var searchType = D.searchTypes.indexOf(D.searchType); // Matches the search type enum in .NET
            D.loading = true;
            AppApi.FindScreenshotsBySearch(D.search, searchType)
                .then((json) => {
                    var results = JSON.parse(json);

                    if (results.length === 0) {
                        D.metadata = {};
                        D.metadata.error = 'No results found';

                        D.searchIndex = null;
                        D.searchResults = null;
                        return;
                    }

                    D.searchIndex = 0;
                    D.searchResults = results;

                    // console.log("Search results", results)
                    this.getAndDisplayScreenshot(results[0], false);
                })
                .finally(() => {
                    D.loading = false;
                });
        }, 500);
    };

    $app.methods.screenshotMetadataCarouselChangeSearch = function (index) {
        var D = this.screenshotMetadataDialog;
        var searchIndex = D.searchIndex;
        var filesArr = D.searchResults;

        if (searchIndex === null) {
            return;
        }

        if (index === 0) {
            if (searchIndex > 0) {
                this.getAndDisplayScreenshot(filesArr[searchIndex - 1], false);
                searchIndex--;
            } else {
                this.getAndDisplayScreenshot(
                    filesArr[filesArr.length - 1],
                    false
                );
                searchIndex = filesArr.length - 1;
            }
        } else if (index === 2) {
            if (searchIndex < filesArr.length - 1) {
                this.getAndDisplayScreenshot(filesArr[searchIndex + 1], false);
                searchIndex++;
            } else {
                this.getAndDisplayScreenshot(filesArr[0], false);
                searchIndex = 0;
            }
        }

        if (typeof this.$refs.screenshotMetadataCarousel !== 'undefined') {
            this.$refs.screenshotMetadataCarousel.setActiveItem(1);
        }

        D.searchIndex = searchIndex;
    };

    $app.methods.screenshotMetadataCarouselChange = function (index) {
        var D = this.screenshotMetadataDialog;
        var searchIndex = D.searchIndex;

        if (searchIndex !== null) {
            this.screenshotMetadataCarouselChangeSearch(index);
            return;
        }

        if (index === 0) {
            if (D.metadata.previousFilePath) {
                this.getAndDisplayScreenshot(D.metadata.previousFilePath);
            } else {
                this.getAndDisplayScreenshot(D.metadata.filePath);
            }
        }
        if (index === 2) {
            if (D.metadata.nextFilePath) {
                this.getAndDisplayScreenshot(D.metadata.nextFilePath);
            } else {
                this.getAndDisplayScreenshot(D.metadata.filePath);
            }
        }
        if (typeof this.$refs.screenshotMetadataCarousel !== 'undefined') {
            this.$refs.screenshotMetadataCarousel.setActiveItem(1);
        }

        if (this.fullscreenImageDialog.visible) {
            // TODO
        }
    };

    $app.methods.uploadScreenshotToGallery = function () {
        var D = this.screenshotMetadataDialog;
        if (D.metadata.fileSizeBytes > 10000000) {
            $app.$message({
                message: 'File size too large',
                type: 'error'
            });
            return;
        }
        D.isUploading = true;
        AppApi.GetFileBase64(D.metadata.filePath)
            .then((base64Body) => {
                API.uploadGalleryImage(base64Body)
                    .then((args) => {
                        $app.$message({
                            message: 'Gallery image uploaded',
                            type: 'success'
                        });
                        return args;
                    })
                    .finally(() => {
                        D.isUploading = false;
                    });
            })
            .catch((err) => {
                $app.$message({
                    message: 'Failed to upload gallery image',
                    type: 'error'
                });
                console.error(err);
                D.isUploading = false;
            });
    };

    /**
     * This function is called by .NET(CefCustomDragHandler#CefCustomDragHandler) when a file is dragged over a drop zone in the app window.
     * @param {string} filePath - The full path to the file being dragged into the window
     */
    $app.methods.dragEnterCef = function (filePath) {
        this.currentlyDroppingFile = filePath;
    };

    $app.methods.handleDrop = function (event) {
        if (this.currentlyDroppingFile === null) {
            return;
        }
        console.log('Dropped file into viewer: ', this.currentlyDroppingFile);

        this.screenshotMetadataResetSearch();
        this.getAndDisplayScreenshot(this.currentlyDroppingFile);

        event.preventDefault();
    };

    $app.methods.copyImageToClipboard = function (path) {
        AppApi.CopyImageToClipboard(path).then(() => {
            this.$message({
                message: 'Image copied to clipboard',
                type: 'success'
            });
        });
    };

    $app.methods.openImageFolder = function (path) {
        AppApi.OpenFolderAndSelectItem(path).then(() => {
            this.$message({
                message: 'Opened image folder',
                type: 'success'
            });
        });
    };

    // YouTube API

    $app.data.youTubeApiKey = '';

    $app.data.youTubeApiDialog = {
        visible: false
    };

    API.$on('LOGOUT', function () {
        $app.youTubeApiDialog.visible = false;
    });

    $app.methods.testYouTubeApiKey = async function () {
        if (!this.youTubeApiKey) {
            this.$message({
                message: 'YouTube API key removed',
                type: 'success'
            });
            this.youTubeApiDialog.visible = false;
            return;
        }
        var data = await this.lookupYouTubeVideo('dQw4w9WgXcQ');
        if (!data) {
            this.youTubeApiKey = '';
            this.$message({
                message: 'Invalid YouTube API key',
                type: 'error'
            });
        } else {
            await configRepository.setString(
                'VRCX_youtubeAPIKey',
                this.youTubeApiKey
            );
            this.$message({
                message: 'YouTube API key valid!',
                type: 'success'
            });
            this.youTubeApiDialog.visible = false;
        }
    };

    $app.methods.changeYouTubeApi = async function () {
        await configRepository.setBool('VRCX_youtubeAPI', this.youTubeApi);
        await configRepository.setBool('VRCX_progressPie', this.progressPie);
        await configRepository.setBool(
            'VRCX_progressPieFilter',
            this.progressPieFilter
        );
        this.updateVRLastLocation();
        this.updateOpenVR();
    };

    $app.methods.showYouTubeApiDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.youTubeApiDialog.$el));
        var D = this.youTubeApiDialog;
        D.visible = true;
    };

    // Asset Bundle Cacher

    $app.methods.updateVRChatWorldCache = function () {
        var D = this.worldDialog;
        if (D.visible) {
            D.inCache = false;
            D.cacheSize = 0;
            D.cacheLocked = false;
            D.cachePath = '';
            this.checkVRChatCache(D.ref).then((cacheInfo) => {
                if (cacheInfo.Item1 > 0) {
                    D.inCache = true;
                    D.cacheSize = `${(cacheInfo.Item1 / 1048576).toFixed(
                        2
                    )} MB`;
                    D.cachePath = cacheInfo.Item3;
                }
                D.cacheLocked = cacheInfo.Item2;
            });
        }
    };

    $app.methods.updateVRChatAvatarCache = function () {
        var D = this.avatarDialog;
        if (D.visible) {
            D.inCache = false;
            D.cacheSize = 0;
            D.cacheLocked = false;
            D.cachePath = '';
            this.checkVRChatCache(D.ref).then((cacheInfo) => {
                if (cacheInfo.Item1 > 0) {
                    D.inCache = true;
                    D.cacheSize = `${(cacheInfo.Item1 / 1048576).toFixed(
                        2
                    )} MB`;
                    D.cachePath = cacheInfo.Item3;
                }
                D.cacheLocked = cacheInfo.Item2;
            });
        }
    };

    // eslint-disable-next-line require-await
    $app.methods.checkVRChatCache = async function (ref) {
        if (!ref.unityPackages) {
            return { Item1: -1, Item2: false, Item3: '' };
        }
        var assetUrl = '';
        for (var i = ref.unityPackages.length - 1; i > -1; i--) {
            var unityPackage = ref.unityPackages[i];
            if (unityPackage.variant && unityPackage.variant !== 'standard') {
                continue;
            }
            if (
                unityPackage.platform === 'standalonewindows' &&
                this.compareUnityVersion(unityPackage.unityVersion)
            ) {
                assetUrl = unityPackage.assetUrl;
                break;
            }
        }
        if (!assetUrl) {
            assetUrl = ref.assetUrl;
        }
        var id = extractFileId(assetUrl);
        var version = parseInt(extractFileVersion(assetUrl), 10);
        if (!id || !version) {
            return { Item1: -1, Item2: false, Item3: '' };
        }

        return AssetBundleCacher.CheckVRChatCache(id, version);
    };

    API.getBundles = function (fileId) {
        return this.call(`file/${fileId}`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json
            };
            return args;
        });
    };

    $app.data.cacheAutoDownloadHistory = new Set();

    $app.methods.downloadFileQueueUpdate = async function () {
        if (this.downloadQueue.size === 0) {
            return;
        }
        this.downloadProgress = 0;
        this.downloadIsProcessing = false;
        this.downloadInProgress = true;
        this.downloadCurrent = this.downloadQueue.values().next().value;
        this.downloadCurrent.id = this.downloadQueue.keys().next().value;
        var { ref } = this.downloadCurrent;
        this.downloadQueue.delete(ref.id);
        this.downloadQueueTable.data = Array.from(this.downloadQueue.values());

        var fileUrl = this.downloadCurrent.updateSetupUrl;
        var hashUrl = this.downloadCurrent.updateHashUrl;
        var size = this.downloadCurrent.size;
        await AssetBundleCacher.DownloadFile(fileUrl, hashUrl, size);
        this.downloadFileProgress();
    };

    $app.methods.cancelDownload = function (id) {
        AssetBundleCacher.CancelDownload();
        if (this.downloadQueue.has(id)) {
            this.downloadQueue.delete(id);
            this.downloadQueueTable.data = Array.from(
                this.downloadQueue.values()
            );
        }
    };

    $app.methods.cancelAllDownloads = function () {
        if (typeof this.downloadCurrent.id !== 'undefined') {
            this.cancelDownload(this.downloadCurrent.id);
        }
        for (var queue of this.downloadQueue.values()) {
            this.cancelDownload(queue.ref.id);
        }
    };

    $app.data.downloadProgress = 0;
    $app.data.downloadInProgress = false;
    $app.data.downloadIsProcessing = false;
    $app.data.downloadQueue = new Map();
    $app.data.downloadCurrent = {};

    $app.methods.downloadFileProgress = async function () {
        var downloadProgress = await AssetBundleCacher.CheckDownloadProgress();
        switch (downloadProgress) {
            case -4:
                this.$message({
                    message: 'Download canceled',
                    type: 'info'
                });
                this.downloadFileComplete('Canceled');
                return;
            case -14:
                this.$message({
                    message: 'Download failed, hash mismatch',
                    type: 'error'
                });
                this.downloadFileComplete('Failed');
                return;
            case -15:
                this.$message({
                    message: 'Download failed, size mismatch',
                    type: 'error'
                });
                this.downloadFileComplete('Failed');
                return;
            case -16:
                if (this.downloadCurrent.ref.id === 'VRCXUpdate') {
                    if (this.downloadCurrent.autoInstall) {
                        workerTimers.setTimeout(() => this.restartVRCX(), 2000);
                    } else {
                        this.downloadDialog.visible = false;
                        this.pendingVRCXInstall = this.downloadCurrent.ref.name;
                        this.showVRCXUpdateDialog();
                    }
                }
                this.downloadFileComplete('Success');
                return;
            default:
                this.downloadProgress = downloadProgress;
        }
        workerTimers.setTimeout(() => this.downloadFileProgress(), 150);
    };

    $app.methods.downloadFileComplete = function (status) {
        this.downloadCurrent.status = status;
        this.downloadCurrent.date = Date.now();
        this.downloadHistoryTable.data.unshift(this.downloadCurrent);
        this.downloadCurrent = {};
        this.downloadProgress = 0;
        this.downloadInProgress = false;
        this.downloadFileQueueUpdate();
    };

    $app.methods.showDownloadDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.downloadDialog.$el));
        this.downloadDialog.visible = true;
    };

    $app.data.downloadDialog = {
        visible: false
    };

    $app.methods.downloadProgressText = function () {
        if (this.downloadIsProcessing) {
            return 'Processing';
        }
        if (this.downloadProgress >= 0) {
            return `${this.downloadProgress}%`;
        }
        return '';
    };

    $app.methods.getDisplayName = function (userId) {
        if (userId) {
            var ref = API.cachedUsers.get(userId);
            if (ref.displayName) {
                return ref.displayName;
            }
        }
        return '';
    };

    $app.methods.deleteVRChatCache = async function (ref) {
        var assetUrl = '';
        for (var i = ref.unityPackages.length - 1; i > -1; i--) {
            var unityPackage = ref.unityPackages[i];
            if (unityPackage.variant && unityPackage.variant !== 'standard') {
                continue;
            }
            if (
                unityPackage.platform === 'standalonewindows' &&
                this.compareUnityVersion(unityPackage.unityVersion)
            ) {
                assetUrl = unityPackage.assetUrl;
                break;
            }
        }
        var id = extractFileId(assetUrl);
        var version = parseInt(extractFileVersion(assetUrl), 10);
        await AssetBundleCacher.DeleteCache(id, version);
        this.getVRChatCacheSize();
        this.updateVRChatWorldCache();
        this.updateVRChatAvatarCache();
    };

    $app.methods.showDeleteAllVRChatCacheConfirm = function () {
        this.$confirm(`Continue? Delete all VRChat cache`, 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    this.deleteAllVRChatCache();
                }
            }
        });
    };

    $app.methods.deleteAllVRChatCache = async function () {
        await AssetBundleCacher.DeleteAllCache();
        this.getVRChatCacheSize();
    };

    $app.methods.autoVRChatCacheManagement = function () {
        if (this.autoSweepVRChatCache) {
            this.sweepVRChatCache();
        }
    };

    $app.methods.sweepVRChatCache = async function () {
        await AssetBundleCacher.SweepCache();
        if (this.VRChatConfigDialog.visible) {
            this.getVRChatCacheSize();
        }
    };

    $app.methods.checkIfGameCrashed = function () {
        if (!this.relaunchVRChatAfterCrash) {
            return;
        }
        var { location } = this.lastLocation;
        AppApi.VrcClosedGracefully().then((result) => {
            if (result || !this.isRealInstance(location)) {
                return;
            }
            // wait a bit for SteamVR to potentially close before deciding to relaunch
            var restartDelay = 8000;
            if (this.isGameNoVR) {
                // wait for game to close before relaunching
                restartDelay = 2000;
            }
            workerTimers.setTimeout(
                () => this.restartCrashedGame(location),
                restartDelay
            );
        });
    };

    $app.methods.restartCrashedGame = function (location) {
        if (!this.isGameNoVR && !this.isSteamVRRunning) {
            console.log("SteamVR isn't running, not relaunching VRChat");
            return;
        }
        AppApi.FocusWindow();
        var message = 'VRChat crashed, attempting to rejoin last instance';
        this.$message({
            message,
            type: 'info'
        });
        var entry = {
            created_at: new Date().toJSON(),
            type: 'Event',
            data: message
        };
        database.addGamelogEventToDatabase(entry);
        this.queueGameLogNoty(entry);
        this.addGameLog(entry);
        this.launchGame(location, '', this.isGameNoVR);
    };

    $app.data.VRChatUsedCacheSize = '';
    $app.data.VRChatTotalCacheSize = '';
    $app.data.VRChatCacheSizeLoading = false;

    $app.methods.getVRChatCacheSize = async function () {
        this.VRChatCacheSizeLoading = true;
        var totalCacheSize = 20;
        if (this.VRChatConfigFile.cache_size) {
            totalCacheSize = this.VRChatConfigFile.cache_size;
        }
        this.VRChatTotalCacheSize = totalCacheSize;
        var usedCacheSize = await AssetBundleCacher.GetCacheSize();
        this.VRChatUsedCacheSize = (usedCacheSize / 1073741824).toFixed(2);
        this.VRChatCacheSizeLoading = false;
    };

    $app.methods.getBundleLocation = async function (input) {
        var assetUrl = input;
        if (assetUrl) {
            // continue
        } else if (
            this.avatarDialog.visible &&
            this.avatarDialog.ref.unityPackages.length > 0
        ) {
            var unityPackages = this.avatarDialog.ref.unityPackages;
            for (let i = unityPackages.length - 1; i > -1; i--) {
                var unityPackage = unityPackages[i];
                if (
                    unityPackage.variant &&
                    unityPackage.variant !== 'standard'
                ) {
                    continue;
                }
                if (
                    unityPackage.platform === 'standalonewindows' &&
                    this.compareUnityVersion(unityPackage.unityVersion)
                ) {
                    assetUrl = unityPackage.assetUrl;
                    break;
                }
            }
        } else if (
            this.avatarDialog.visible &&
            this.avatarDialog.ref.assetUrl
        ) {
            assetUrl = this.avatarDialog.ref.assetUrl;
        } else if (
            this.worldDialog.visible &&
            this.worldDialog.ref.unityPackages.length > 0
        ) {
            var unityPackages = this.worldDialog.ref.unityPackages;
            for (let i = unityPackages.length - 1; i > -1; i--) {
                var unityPackage = unityPackages[i];
                if (
                    unityPackage.platform === 'standalonewindows' &&
                    this.compareUnityVersion(unityPackage.unityVersion)
                ) {
                    assetUrl = unityPackage.assetUrl;
                    break;
                }
            }
        } else if (this.worldDialog.visible && this.worldDialog.ref.assetUrl) {
            assetUrl = this.worldDialog.ref.assetUrl;
        }
        if (!assetUrl) {
            return null;
        }
        var fileId = extractFileId(assetUrl);
        var fileVersion = parseInt(extractFileVersion(assetUrl), 10);
        var assetLocation = await AssetBundleCacher.GetVRChatCacheFullLocation(
            fileId,
            fileVersion
        );
        var cacheInfo = await AssetBundleCacher.CheckVRChatCache(
            fileId,
            fileVersion
        );
        var inCache = false;
        if (cacheInfo.Item1 > 0) {
            inCache = true;
        }
        console.log(`InCache: ${inCache}`);
        var fullAssetLocation = `${assetLocation}\\__data`;
        console.log(fullAssetLocation);
        return fullAssetLocation;
    };

    API.$on('LOGIN', function () {
        $app.downloadDialog.visible = false;
    });

    // Parse User URL

    $app.methods.parseUserUrl = function (user) {
        var url = new URL(user);
        var urlPath = url.pathname;
        if (urlPath.substring(5, 11) === '/user/') {
            var userId = urlPath.substring(11);
            return userId;
        }
        return void 0;
    };

    // Parse Avatar URL

    $app.methods.parseAvatarUrl = function (avatar) {
        var url = new URL(avatar);
        var urlPath = url.pathname;
        if (urlPath.substring(5, 13) === '/avatar/') {
            var avatarId = urlPath.substring(13);
            return avatarId;
        }
        return void 0;
    };

    // userDialog Favorite Worlds

    $app.data.userFavoriteWorlds = [];

    $app.methods.getUserFavoriteWorlds = async function (userId) {
        this.userDialog.isFavoriteWorldsLoading = true;
        this.$refs.favoriteWorlds.currentName = '0'; // select first tab
        this.userFavoriteWorlds = [];
        var worldLists = [];
        var params = {
            ownerId: userId
        };
        var json = await API.call('favorite/groups', {
            method: 'GET',
            params
        });
        for (var i = 0; i < json.length; ++i) {
            var list = json[i];
            if (list.type !== 'world') {
                continue;
            }
            var params = {
                n: 100,
                offset: 0,
                userId,
                tag: list.name
            };
            try {
                var args = await API.getFavoriteWorlds(params);
                worldLists.push([list.displayName, list.visibility, args.json]);
            } catch (err) {}
        }
        this.userFavoriteWorlds = worldLists;
        this.userDialog.isFavoriteWorldsLoading = false;
    };

    $app.data.worldGroupVisibilityOptions = ['private', 'friends', 'public'];

    $app.methods.userFavoriteWorldsStatus = function (visibility) {
        var style = {};
        if (visibility === 'public') {
            style.online = true;
        } else if (visibility === 'friends') {
            style.joinme = true;
        } else {
            style.busy = true;
        }
        return style;
    };

    $app.methods.changeWorldGroupVisibility = function (name, visibility) {
        var params = {
            type: 'world',
            group: name,
            visibility
        };
        API.saveFavoriteGroup(params).then((args) => {
            this.$message({
                message: 'Group visibility changed',
                type: 'success'
            });
            return args;
        });
    };

    $app.methods.refreshInstancePlayerCount = function (instance) {
        var L = API.parseLocation(instance);
        if (L.worldId && L.instanceId) {
            API.getInstance({
                worldId: L.worldId,
                instanceId: L.instanceId
            });
        }
    };

    // userDialog Groups

    $app.data.userGroups = {
        groups: [],
        ownGroups: [],
        mutualGroups: [],
        remainingGroups: []
    };

    $app.methods.getUserGroups = async function (userId) {
        this.userDialog.isGroupsLoading = true;
        this.userGroups = {
            groups: [],
            ownGroups: [],
            mutualGroups: [],
            remainingGroups: []
        };
        var params = {
            n: 100,
            offset: 0,
            userId
        };
        var args = await API.getGroups(params);
        if (userId === API.currentUser.id) {
            // update current user groups
            API.currentUserGroups.clear();
            args.json.forEach((group) => {
                API.currentUserGroups.set(group.id, group);
            });
        }
        this.userGroups.groups = args.json;
        for (var i = 0; i < args.json.length; ++i) {
            var group = args.json[i];
            if (group.ownerId === userId) {
                this.userGroups.ownGroups.unshift(group);
            }
            if (userId === API.currentUser.id) {
                // skip mutual groups for current user
                if (group.ownerId !== userId) {
                    this.userGroups.remainingGroups.unshift(group);
                }
                continue;
            }
            if (group.mutualGroup) {
                this.userGroups.mutualGroups.unshift(group);
            }
            if (!group.mutualGroup && group.ownerId !== userId) {
                this.userGroups.remainingGroups.unshift(group);
            }
        }
        this.userDialog.isGroupsLoading = false;
        if (userId === API.currentUser.id) {
            this.sortCurrentUserGroups();
        }
    };

    $app.methods.getCurrentUserGroups = async function () {
        var args = await API.getGroups({ n: 100, userId: API.currentUser.id });
        API.currentUserGroups.clear();
        args.json.forEach((group) => {
            API.currentUserGroups.set(group.id, group);
        });
    };

    $app.methods.sortCurrentUserGroups = function () {
        var groupList = [];
        var sortGroups = function (a, b) {
            var aIndex = groupList.indexOf(a.id);
            var bIndex = groupList.indexOf(b.id);
            if (aIndex === -1 && bIndex === -1) {
                return 0;
            }
            if (aIndex === -1) {
                return 1;
            }
            if (bIndex === -1) {
                return -1;
            }
            return aIndex - bIndex;
        };
        AppApi.GetVRChatRegistryKey(
            `VRC_GROUP_ORDER_${API.currentUser.id}`
        ).then((json) => {
            groupList = JSON.parse(json);
            this.userGroups.remainingGroups.sort(sortGroups);
        });
    };

    // #endregion
    // #region | Gallery

    $app.data.galleryDialog = {};
    $app.data.galleryDialogVisible = false;
    $app.data.galleryDialogGalleryLoading = false;
    $app.data.galleryDialogIconsLoading = false;

    API.$on('LOGIN', function () {
        $app.galleryTable = [];
    });

    $app.methods.showGalleryDialog = function () {
        this.galleryDialogVisible = true;
        this.refreshGalleryTable();
        this.refreshVRCPlusIconsTable();
        this.refreshEmojiTable();
    };

    $app.methods.refreshGalleryTable = function () {
        this.galleryDialogGalleryLoading = true;
        var params = {
            n: 100,
            tag: 'gallery'
        };
        API.getFileList(params);
    };

    API.$on('FILES:LIST', function (args) {
        if (args.params.tag === 'gallery') {
            $app.galleryTable = args.json.reverse();
            $app.galleryDialogGalleryLoading = false;
        }
    });

    $app.methods.setProfilePicOverride = function (fileId) {
        if (!API.currentUser.$isVRCPlus) {
            this.$message({
                message: 'VRCPlus required',
                type: 'error'
            });
            return;
        }
        var profilePicOverride = '';
        if (fileId) {
            profilePicOverride = `${API.endpointDomain}/file/${fileId}/1`;
        }
        if (profilePicOverride === API.currentUser.profilePicOverride) {
            return;
        }
        API.saveCurrentUser({
            profilePicOverride
        }).then((args) => {
            this.$message({
                message: 'Profile picture changed',
                type: 'success'
            });
            return args;
        });
    };

    $app.methods.deleteGalleryImage = function (fileId) {
        API.deleteFile(fileId).then((args) => {
            API.$emit('GALLERYIMAGE:DELETE', args);
            return args;
        });
    };

    API.$on('GALLERYIMAGE:DELETE', function (args) {
        var array = $app.galleryTable;
        var { length } = array;
        for (var i = 0; i < length; ++i) {
            if (args.fileId === array[i].id) {
                array.splice(i, 1);
                break;
            }
        }
    });

    $app.methods.compareCurrentProfilePic = function (fileId) {
        var currentProfilePicOverride = extractFileId(
            API.currentUser.profilePicOverride
        );
        if (fileId === currentProfilePicOverride) {
            return true;
        }
        return false;
    };

    $app.methods.onFileChangeGallery = function (e) {
        var clearFile = function () {
            if (document.querySelector('#GalleryUploadButton')) {
                document.querySelector('#GalleryUploadButton').value = '';
            }
        };
        var files = e.target.files || e.dataTransfer.files;
        if (!files.length) {
            return;
        }
        if (files[0].size >= 10000000) {
            // 10MB
            $app.$message({
                message: 'File size too large',
                type: 'error'
            });
            clearFile();
            return;
        }
        if (!files[0].type.match(/image.*/)) {
            $app.$message({
                message: "File isn't an image",
                type: 'error'
            });
            clearFile();
            return;
        }
        var r = new FileReader();
        r.onload = function () {
            var base64Body = btoa(r.result);
            API.uploadGalleryImage(base64Body).then((args) => {
                $app.$message({
                    message: 'Gallery image uploaded',
                    type: 'success'
                });
                return args;
            });
        };
        r.readAsBinaryString(files[0]);
        clearFile();
    };

    $app.methods.displayGalleryUpload = function () {
        document.getElementById('GalleryUploadButton').click();
    };

    API.uploadGalleryImage = function (imageData) {
        var params = {
            tag: 'gallery'
        };
        return this.call('file/image', {
            uploadImage: true,
            postData: JSON.stringify(params),
            imageData
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GALLERYIMAGE:ADD', args);
            return args;
        });
    };

    API.$on('GALLERYIMAGE:ADD', function (args) {
        if (Object.keys($app.galleryTable).length !== 0) {
            $app.galleryTable.push(args.json);
        }
    });

    // #endregion
    // #region | Emoji

    API.$on('LOGIN', function () {
        $app.emojiTable = [];
    });

    $app.methods.refreshEmojiTable = function () {
        this.galleryDialogIconsLoading = true;
        var params = {
            n: 100,
            tag: 'emoji'
        };
        API.getFileList(params);
    };

    API.$on('FILES:LIST', function (args) {
        if (args.params.tag === 'emoji') {
            $app.emojiTable = args.json.reverse();
            $app.galleryDialogIconsLoading = false;
        }
    });

    $app.methods.deleteEmoji = function (fileId) {
        API.deleteFile(fileId).then((args) => {
            API.$emit('EMOJI:DELETE', args);
            return args;
        });
    };

    API.$on('EMOJI:DELETE', function (args) {
        var array = $app.emojiTable;
        var { length } = array;
        for (var i = 0; i < length; ++i) {
            if (args.fileId === array[i].id) {
                array.splice(i, 1);
                break;
            }
        }
    });

    $app.methods.onFileChangeEmoji = function (e) {
        var clearFile = function () {
            if (document.querySelector('#EmojiUploadButton')) {
                document.querySelector('#EmojiUploadButton').value = '';
            }
        };
        var files = e.target.files || e.dataTransfer.files;
        if (!files.length) {
            return;
        }
        if (files[0].size >= 10000000) {
            // 10MB
            $app.$message({
                message: 'File size too large',
                type: 'error'
            });
            clearFile();
            return;
        }
        if (!files[0].type.match(/image.*/)) {
            $app.$message({
                message: "File isn't an image",
                type: 'error'
            });
            clearFile();
            return;
        }
        var r = new FileReader();
        r.onload = function () {
            var params = {
                tag: 'emoji',
                animationStyle: $app.emojiAnimationStyle.toLowerCase(),
                maskTag: 'square'
            };
            var base64Body = btoa(r.result);
            API.uploadEmoji(base64Body, params).then((args) => {
                $app.$message({
                    message: 'Emoji uploaded',
                    type: 'success'
                });
                return args;
            });
        };
        r.readAsBinaryString(files[0]);
        clearFile();
    };

    $app.methods.displayEmojiUpload = function () {
        document.getElementById('EmojiUploadButton').click();
    };

    API.uploadEmoji = function (imageData, params) {
        return this.call('file/image', {
            uploadImage: true,
            postData: JSON.stringify(params),
            imageData
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('EMOJI:ADD', args);
            return args;
        });
    };

    API.$on('EMOJI:ADD', function (args) {
        if (Object.keys($app.emojiTable).length !== 0) {
            $app.emojiTable.push(args.json);
        }
    });

    $app.data.emojiAnimationStyle = 'Aura';
    $app.data.emojiAnimationStyleUrl =
        'https://assets.vrchat.com/www/images/emoji-previews/';
    $app.data.emojiAnimationStyleList = {
        Aura: 'Preview_B2-Aura.gif',
        Bats: 'Preview_B2-Fall_Bats.gif',
        Bees: 'Preview_B2-Bees.gif',
        Bounce: 'Preview_B2-Bounce.gif',
        Cloud: 'Preview_B2-Cloud.gif',
        Confetti: 'Preview_B2-Winter_Confetti.gif',
        Crying: 'Preview_B2-Crying.gif',
        Dislike: 'Preview_B2-Dislike.gif',
        Fire: 'Preview_B2-Fire.gif',
        Idea: 'Preview_B2-Idea.gif',
        Lasers: 'Preview_B2-Lasers.gif',
        Like: 'Preview_B2-Like.gif',
        Magnet: 'Preview_B2-Magnet.gif',
        Mistletoe: 'Preview_B2-Winter_Mistletoe.gif',
        Money: 'Preview_B2-Money.gif',
        Noise: 'Preview_B2-Noise.gif',
        Orbit: 'Preview_B2-Orbit.gif',
        Pizza: 'Preview_B2-Pizza.gif',
        Rain: 'Preview_B2-Rain.gif',
        Rotate: 'Preview_B2-Rotate.gif',
        Shake: 'Preview_B2-Shake.gif',
        Snow: 'Preview_B2-Spin.gif',
        Snowball: 'Preview_B2-Winter_Snowball.gif',
        Spin: 'Preview_B2-Spin.gif',
        Splash: 'Preview_B2-SummerSplash.gif',
        Stop: 'Preview_B2-Stop.gif',
        ZZZ: 'Preview_B2-ZZZ.gif'
    };

    // #endregion
    // #region Misc

    $app.methods.replaceBioSymbols = function (text) {
        if (!text) {
            return '';
        }
        var symbolList = {
            '@': '＠',
            '#': '＃',
            $: '＄',
            '%': '％',
            '&': '＆',
            '=': '＝',
            '+': '＋',
            '/': '⁄',
            '\\': '＼',
            ';': ';',
            ':': '˸',
            ',': '‚',
            '?': '？',
            '!': 'ǃ',
            '"': '＂',
            '<': '≺',
            '>': '≻',
            '.': '․',
            '^': '＾',
            '{': '｛',
            '}': '｝',
            '[': '［',
            ']': '］',
            '(': '（',
            ')': '）',
            '|': '｜',
            '*': '∗'
        };
        var newText = text;
        for (var key in symbolList) {
            var regex = new RegExp(symbolList[key], 'g');
            newText = newText.replace(regex, key);
        }
        return newText.replace(/ {1,}/g, ' ').trimRight();
    };

    $app.methods.removeEmojis = function (text) {
        if (!text) {
            return '';
        }
        return text
            .replace(
                /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
                ''
            )
            .replace(/\s+/g, ' ')
            .trim();
    };

    $app.methods.checkCanInvite = function (location) {
        var L = API.parseLocation(location);
        if (
            L.accessType === 'public' ||
            L.accessType === 'group' ||
            L.userId === API.currentUser.id
        ) {
            return true;
        }
        if (L.accessType === 'invite') {
            return false;
        }
        if (this.lastLocation.location === location) {
            return true;
        }
        return false;
    };

    $app.methods.checkCanInviteSelf = function (location) {
        var L = API.parseLocation(location);
        if (L.userId === API.currentUser.id) {
            return true;
        }
        if (L.accessType === 'friends' && !this.friends.has(L.userId)) {
            return false;
        }
        return true;
    };

    $app.methods.setAsideWidth = async function () {
        document.getElementById('aside').style.width = `${this.asideWidth}px`;
        await configRepository.setInt('VRCX_sidePanelWidth', this.asideWidth);
    };

    // VRCX auto update

    $app.data.VRCXUpdateDialog = {
        visible: false,
        updatePending: false,
        updatePendingIsLatest: false,
        release: '',
        releases: [],
        json: {}
    };

    $app.data.checkingForVRCXUpdate = false;
    $app.data.pendingVRCXInstall = '';
    $app.data.pendingVRCXUpdate = false;

    $app.data.branches = {
        Stable: {
            name: 'Stable',
            urlReleases: 'https://vrcx.pypy.moe/releases/vrcx-team.json',
            urlLatest: 'https://vrcx.pypy.moe/releases/latest/vrcx-team.json'
        },
        Nightly: {
            name: 'Nightly',
            urlReleases: 'https://vrcx.pypy.moe/releases/natsumi-sama.json',
            urlLatest: 'https://vrcx.pypy.moe/releases/latest/natsumi-sama.json'
        }
    };

    $app.methods.showVRCXUpdateDialog = async function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.VRCXUpdateDialog.$el));
        var D = this.VRCXUpdateDialog;
        D.visible = true;
        D.updatePendingIsLatest = false;
        D.updatePending = await AppApi.CheckForUpdateExe();
        this.loadBranchVersions();
    };

    $app.methods.downloadVRCXUpdate = function (
        updateSetupUrl,
        updateHashUrl,
        size,
        name,
        type,
        autoInstall
    ) {
        var ref = {
            id: 'VRCXUpdate',
            name
        };
        this.downloadQueue.set('VRCXUpdate', {
            ref,
            type,
            updateSetupUrl,
            updateHashUrl,
            size,
            autoInstall
        });
        this.downloadQueueTable.data = Array.from(this.downloadQueue.values());
        if (!this.downloadInProgress) {
            this.downloadFileQueueUpdate();
        }
    };

    $app.methods.installVRCXUpdate = function () {
        for (var release of this.VRCXUpdateDialog.releases) {
            if (release.name === this.VRCXUpdateDialog.release) {
                var downloadUrl = '';
                var hashUrl = '';
                var size = 0;
                for (var asset of release.assets) {
                    if (asset.state !== 'uploaded') {
                        continue;
                    }
                    if (
                        asset.content_type === 'application/x-msdownload' ||
                        asset.content_type === 'application/x-msdos-program'
                    ) {
                        downloadUrl = asset.browser_download_url;
                        size = asset.size;
                        continue;
                    }
                    if (
                        asset.name === 'SHA256SUMS.txt' &&
                        asset.content_type === 'text/plain'
                    ) {
                        hashUrl = asset.browser_download_url;
                        continue;
                    }
                }
                if (!downloadUrl) {
                    return;
                }
                var name = release.name;
                var type = 'Manual';
                var autoInstall = false;
                this.downloadVRCXUpdate(
                    downloadUrl,
                    hashUrl,
                    size,
                    name,
                    type,
                    autoInstall
                );
                this.VRCXUpdateDialog.visible = false;
                this.showDownloadDialog();
            }
        }
    };

    $app.methods.restartVRCX = function () {
        AppApi.RestartApplication();
    };

    $app.methods.loadBranchVersions = async function () {
        var D = this.VRCXUpdateDialog;
        var url = this.branches[this.branch].urlReleases;
        this.checkingForVRCXUpdate = true;
        try {
            var response = await webApiService.execute({
                url,
                method: 'GET'
            });
        } finally {
            this.checkingForVRCXUpdate = false;
        }
        var json = JSON.parse(response.data);
        if (this.debugWebRequests) {
            console.log(json, response);
        }
        var releases = [];
        if (typeof json !== 'object' || json.message) {
            $app.$message({
                message: `Failed to check for update, "${json.message}"`,
                type: 'error'
            });
            return;
        }
        for (var release of json) {
            if (
                release.target_commitish === 'PyPyDanceCompanion' ||
                release.prerelease
            ) {
                // skip old branch name and prerelease builds
                continue;
            }
            for (var asset of release.assets) {
                if (
                    (asset.content_type === 'application/x-msdownload' ||
                        asset.content_type === 'application/x-msdos-program') &&
                    asset.state === 'uploaded'
                ) {
                    releases.push(release);
                }
            }
        }
        D.releases = releases;
        D.release = json[0].name;
        this.VRCXUpdateDialog.updatePendingIsLatest = false;
        if (D.release === this.pendingVRCXInstall) {
            // update already downloaded and latest version
            this.VRCXUpdateDialog.updatePendingIsLatest = true;
        }
        if ((await configRepository.getString('VRCX_branch')) !== this.branch) {
            await configRepository.setString('VRCX_branch', this.branch);
        }
    };

    $app.methods.saveAutoUpdateVRCX = async function () {
        if (this.autoUpdateVRCX === 'Off') {
            this.pendingVRCXUpdate = false;
        }
        await configRepository.setString(
            'VRCX_autoUpdateVRCX',
            this.autoUpdateVRCX
        );
    };

    $app.methods.checkForVRCXUpdate = async function () {
        if (
            !this.appVersion ||
            this.appVersion === 'VRCX Nightly Build' ||
            this.appVersion === 'VRCX Build'
        ) {
            return;
        }
        if (this.branch === 'Beta') {
            // move Beta users to stable
            this.branch = 'Stable';
            await configRepository.setString('VRCX_branch', this.branch);
        }
        var url = this.branches[this.branch].urlLatest;
        this.checkingForVRCXUpdate = true;
        try {
            var response = await webApiService.execute({
                url,
                method: 'GET'
            });
        } finally {
            this.checkingForVRCXUpdate = false;
        }
        this.pendingVRCXUpdate = false;
        var json = JSON.parse(response.data);
        if (this.debugWebRequests) {
            console.log(json, response);
        }
        if (json === Object(json) && json.name && json.published_at) {
            this.VRCXUpdateDialog.updateJson = json;
            this.changeLogDialog.buildName = json.name;
            this.changeLogDialog.changeLog = this.changeLogRemoveLinks(
                json.body
            );
            this.latestAppVersion = json.name;
            var name = json.name;
            this.VRCXUpdateDialog.updatePendingIsLatest = false;
            if (name === this.pendingVRCXInstall) {
                // update already downloaded
                this.VRCXUpdateDialog.updatePendingIsLatest = true;
            } else if (name > this.appVersion) {
                var downloadUrl = '';
                var hashUrl = '';
                var size = 0;
                for (var asset of json.assets) {
                    if (asset.state !== 'uploaded') {
                        continue;
                    }
                    if (
                        asset.content_type === 'application/x-msdownload' ||
                        asset.content_type === 'application/x-msdos-program'
                    ) {
                        downloadUrl = asset.browser_download_url;
                        size = asset.size;
                        continue;
                    }
                    if (
                        asset.name === 'SHA256SUMS.txt' &&
                        asset.content_type === 'text/plain'
                    ) {
                        hashUrl = asset.browser_download_url;
                        continue;
                    }
                }
                if (!downloadUrl) {
                    return;
                }
                this.pendingVRCXUpdate = true;
                this.notifyMenu('settings');
                var type = 'Auto';
                if (!API.isLoggedIn) {
                    this.showVRCXUpdateDialog();
                } else if (this.autoUpdateVRCX === 'Notify') {
                    // this.showVRCXUpdateDialog();
                } else if (this.autoUpdateVRCX === 'Auto Download') {
                    var autoInstall = false;
                    this.downloadVRCXUpdate(
                        downloadUrl,
                        hashUrl,
                        size,
                        name,
                        type,
                        autoInstall
                    );
                } else if (this.autoUpdateVRCX === 'Auto Install') {
                    var autoInstall = true;
                    this.downloadVRCXUpdate(
                        downloadUrl,
                        hashUrl,
                        size,
                        name,
                        type,
                        autoInstall
                    );
                }
            }
        }
    };

    $app.methods.compareUnityVersion = function (version) {
        if (!API.cachedConfig.sdkUnityVersion) {
            console.error('No cachedConfig.sdkUnityVersion');
            return false;
        }
        var currentUnityVersion = API.cachedConfig.sdkUnityVersion.replace(
            /\D/g,
            ''
        );
        // limit to 8 characters because 2019.4.31f1c1 is a thing
        currentUnityVersion = currentUnityVersion.slice(0, 8);
        var assetVersion = version.replace(/\D/g, '');
        assetVersion = assetVersion.slice(0, 8);
        if (parseInt(assetVersion, 10) <= parseInt(currentUnityVersion, 10)) {
            return true;
        }
        return false;
    };

    $app.methods.userImage = function (user) {
        if (typeof user === 'undefined') {
            return '';
        }
        if (this.displayVRCPlusIconsAsAvatar && user.userIcon) {
            return user.userIcon;
        }
        if (user.profilePicOverride) {
            return user.profilePicOverride;
        }
        if (user.thumbnailUrl) {
            return user.thumbnailUrl;
        }
        return user.currentAvatarThumbnailImageUrl;
    };

    $app.methods.userImageFull = function (user) {
        if (this.displayVRCPlusIconsAsAvatar && user.userIcon) {
            return user.userIcon;
        }
        if (user.profilePicOverride) {
            return user.profilePicOverride;
        }
        return user.currentAvatarImageUrl;
    };

    $app.methods.showConsole = function () {
        AppApi.ShowDevTools();
        if (
            this.debug ||
            this.debugWebRequests ||
            this.debugWebSocket ||
            this.debugUserDiff
        ) {
            return;
        }
        console.log(
            '%cCareful! This might not do what you think.',
            'background-color: red; color: yellow; font-size: 32px; font-weight: bold'
        );
        console.log(
            '%cIf someone told you to copy-paste something here, it can give them access to your account.',
            'font-size: 20px;'
        );
    };

    $app.methods.clearVRCXCache = function () {
        API.failedGetRequests = new Map();
        API.cachedUsers.forEach((ref, id) => {
            if (
                !this.friends.has(id) &&
                !this.lastLocation.playerList.has(ref.displayName) &&
                id !== API.currentUser.id
            ) {
                API.cachedUsers.delete(id);
            }
        });
        API.cachedWorlds.forEach((ref, id) => {
            if (
                !API.cachedFavoritesByObjectId.has(id) &&
                ref.authorId !== API.currentUser.id &&
                !this.localWorldFavoritesList.includes(id)
            ) {
                API.cachedWorlds.delete(id);
            }
        });
        API.cachedAvatars.forEach((ref, id) => {
            if (
                !API.cachedFavoritesByObjectId.has(id) &&
                ref.authorId !== API.currentUser.id &&
                !$app.avatarHistory.has(id)
            ) {
                API.cachedAvatars.delete(id);
            }
        });
        API.cachedGroups.forEach((ref, id) => {
            if (!API.currentUserGroups.has(id)) {
                API.cachedGroups.delete(id);
            }
        });
        API.cachedInstances.forEach((ref, id) => {
            // delete instances over an hour old
            if (Date.parse(ref.$fetchedAt) < Date.now() - 3600000) {
                API.cachedInstances.delete(id);
            }
        });
        API.cachedAvatarNames = new Map();
        this.customUserTags = new Map();
        this.updateInstanceInfo = 0;
    };

    $app.data.sqliteTableSizes = {};

    $app.methods.getSqliteTableSizes = async function () {
        this.sqliteTableSizes = {
            gps: await database.getGpsTableSize(),
            status: await database.getStatusTableSize(),
            bio: await database.getBioTableSize(),
            avatar: await database.getAvatarTableSize(),
            onlineOffline: await database.getOnlineOfflineTableSize(),
            friendLogHistory: await database.getFriendLogHistoryTableSize(),
            notification: await database.getNotificationTableSize(),
            location: await database.getLocationTableSize(),
            joinLeave: await database.getJoinLeaveTableSize(),
            portalSpawn: await database.getPortalSpawnTableSize(),
            videoPlay: await database.getVideoPlayTableSize(),
            event: await database.getEventTableSize(),
            external: await database.getExternalTableSize()
        };
    };

    $app.data.ipcEnabled = false;
    $app.methods.ipcEvent = function (json) {
        if (!this.friendLogInitStatus) {
            return;
        }
        try {
            var data = JSON.parse(json);
        } catch {
            console.log(`IPC invalid JSON, ${json}`);
            return;
        }
        switch (data.type) {
            case 'OnEvent':
                if (!this.isGameRunning) {
                    console.log('Game closed, skipped event', data);
                    return;
                }
                if (this.debugPhotonLogging) {
                    console.log(
                        'OnEvent',
                        data.OnEventData.Code,
                        data.OnEventData
                    );
                }
                this.parsePhotonEvent(data.OnEventData, data.dt);
                this.photonEventPulse();
                break;
            case 'OnOperationResponse':
                if (!this.isGameRunning) {
                    console.log('Game closed, skipped event', data);
                    return;
                }
                if (this.debugPhotonLogging) {
                    console.log(
                        'OnOperationResponse',
                        data.OnOperationResponseData.OperationCode,
                        data.OnOperationResponseData
                    );
                }
                this.parseOperationResponse(
                    data.OnOperationResponseData,
                    data.dt
                );
                this.photonEventPulse();
                break;
            case 'OnOperationRequest':
                if (!this.isGameRunning) {
                    console.log('Game closed, skipped event', data);
                    return;
                }
                if (this.debugPhotonLogging) {
                    console.log(
                        'OnOperationRequest',
                        data.OnOperationRequestData.OperationCode,
                        data.OnOperationRequestData
                    );
                }
                break;
            case 'VRCEvent':
                if (!this.isGameRunning) {
                    console.log('Game closed, skipped event', data);
                    return;
                }
                this.parseVRCEvent(data);
                this.photonEventPulse();
                break;
            case 'Event7List':
                this.photonEvent7List.clear();
                for (var [id, dt] of Object.entries(data.Event7List)) {
                    this.photonEvent7List.set(parseInt(id, 10), dt);
                }
                this.photonLastEvent7List = Date.parse(data.dt);
                break;
            case 'VrcxMessage':
                if (this.debugPhotonLogging) {
                    console.log('VrcxMessage:', data);
                }
                this.eventVrcxMessage(data);
                break;
            case 'Ping':
                if (!this.photonLoggingEnabled) {
                    this.photonLoggingEnabled = true;
                    configRepository.setBool('VRCX_photonLoggingEnabled', true);
                }
                this.ipcEnabled = true;
                this.ipcTimeout = 60; // 30secs
                break;
            case 'MsgPing':
                this.externalNotifierVersion = data.version;
                break;
            case 'LaunchCommand':
                AppApi.FocusWindow();
                this.eventLaunchCommand(data.command);
                break;
            case 'VRCXLaunch':
                console.log('VRCXLaunch:', data);
                break;
            default:
                console.log('IPC:', data);
        }
    };

    $app.data.externalNotifierVersion = 0;
    $app.data.photonEventCount = 0;
    $app.data.photonEventIcon = false;
    $app.data.customUserTags = new Map();

    $app.methods.addCustomTag = function (data) {
        if (data.Tag) {
            this.customUserTags.set(data.UserId, {
                tag: data.Tag,
                colour: data.TagColour
            });
        } else {
            this.customUserTags.delete(data.UserId);
        }
        var feedUpdate = {
            userId: data.UserId,
            colour: data.TagColour
        };
        AppApi.ExecuteVrOverlayFunction(
            'updateHudFeedTag',
            JSON.stringify(feedUpdate)
        );
        var ref = API.cachedUsers.get(data.UserId);
        if (typeof ref !== 'undefined') {
            ref.$customTag = data.Tag;
            ref.$customTagColour = data.TagColour;
        }
        this.updateSharedFeed(true);
    };

    $app.methods.eventVrcxMessage = function (data) {
        switch (data.MsgType) {
            case 'CustomTag':
                this.addCustomTag(data);
                break;
            case 'ClearCustomTags':
                this.customUserTags.forEach((value, key) => {
                    this.customUserTags.delete(key);
                    var ref = API.cachedUsers.get(key);
                    if (typeof ref !== 'undefined') {
                        ref.$customTag = '';
                        ref.$customTagColour = '';
                    }
                });
                break;
            case 'Noty':
                if (
                    this.photonLoggingEnabled ||
                    (this.externalNotifierVersion &&
                        this.externalNotifierVersion > 21)
                ) {
                    return;
                }
                var entry = {
                    created_at: new Date().toJSON(),
                    type: 'Event',
                    data: data.Data
                };
                database.addGamelogEventToDatabase(entry);
                this.queueGameLogNoty(entry);
                this.addGameLog(entry);
                break;
            case 'External':
                var displayName = data.DisplayName ?? '';
                var entry = {
                    created_at: new Date().toJSON(),
                    type: 'External',
                    message: data.Data,
                    displayName,
                    userId: data.UserId,
                    location: this.lastLocation.location
                };
                database.addGamelogExternalToDatabase(entry);
                this.queueGameLogNoty(entry);
                this.addGameLog(entry);
                break;
            default:
                console.log('VRCXMessage:', data);
                break;
        }
    };

    $app.methods.photonEventPulse = function () {
        this.photonEventCount++;
        this.photonEventIcon = true;
        workerTimers.setTimeout(() => (this.photonEventIcon = false), 150);
    };

    $app.methods.parseOperationResponse = function (data, dateTime) {
        switch (data.OperationCode) {
            case 226:
                if (
                    typeof data.Parameters[248] !== 'undefined' &&
                    typeof data.Parameters[248][248] !== 'undefined'
                ) {
                    this.setPhotonLobbyMaster(data.Parameters[248][248]);
                }
                if (typeof data.Parameters[254] !== 'undefined') {
                    this.photonLobbyCurrentUser = data.Parameters[254];
                }
                if (typeof data.Parameters[249] !== 'undefined') {
                    for (var i in data.Parameters[249]) {
                        var id = parseInt(i, 10);
                        var user = data.Parameters[249][i];
                        this.parsePhotonUser(id, user.user, dateTime);
                        this.parsePhotonAvatarChange(
                            id,
                            user.user,
                            user.avatarDict,
                            dateTime
                        );
                        this.parsePhotonGroupChange(
                            id,
                            user.user,
                            user.groupOnNameplate,
                            dateTime
                        );
                        this.parsePhotonAvatar(user.avatarDict);
                        this.parsePhotonAvatar(user.favatarDict);
                        var hasInstantiated = false;
                        var lobbyJointime = this.photonLobbyJointime.get(id);
                        if (typeof lobbyJointime !== 'undefined') {
                            hasInstantiated = lobbyJointime.hasInstantiated;
                        }
                        this.photonLobbyJointime.set(id, {
                            joinTime: Date.parse(dateTime),
                            hasInstantiated,
                            inVRMode: user.inVRMode,
                            avatarEyeHeight: user.avatarEyeHeight,
                            canModerateInstance: user.canModerateInstance,
                            groupOnNameplate: user.groupOnNameplate,
                            showGroupBadgeToOthers: user.showGroupBadgeToOthers,
                            showSocialRank: user.showSocialRank,
                            useImpostorAsFallback: user.useImpostorAsFallback
                        });
                    }
                }
                if (typeof data.Parameters[252] !== 'undefined') {
                    this.parsePhotonLobbyIds(data.Parameters[252]);
                }
                this.photonEvent7List = new Map();
                break;
        }
    };

    API.$on('LOGIN', async function () {
        var command = await AppApi.GetLaunchCommand();
        if (command) {
            $app.eventLaunchCommand(command);
        }
    });

    $app.methods.eventLaunchCommand = function (input) {
        if (!API.isLoggedIn) {
            return;
        }
        var args = input.split('/');
        var command = args[0];
        var commandArg = args[1];
        switch (command) {
            case 'world':
                this.directAccessWorld(input.replace('world/', ''));
                break;
            case 'avatar':
                this.showAvatarDialog(commandArg);
                break;
            case 'user':
                this.showUserDialog(commandArg);
                break;
            case 'group':
                this.showGroupDialog(commandArg);
                break;
            case 'local-favorite-world':
                console.log('local-favorite-world', commandArg);
                var [id, group] = commandArg.split(':');
                API.getCachedWorld({ worldId: id }).then((args1) => {
                    this.directAccessWorld(id);
                    this.addLocalWorldFavorite(id, group);
                    return args1;
                });
                break;
            case 'addavatardb':
                this.addAvatarProvider(input.replace('addavatardb/', ''));
                break;
            case 'import':
                var type = args[1];
                if (!type) break;
                var data = input.replace(`import/${type}/`, '');
                if (type === 'avatar') {
                    this.showAvatarImportDialog();
                    this.worldImportDialog.input = data;
                } else if (type === 'world') {
                    this.showWorldImportDialog();
                    this.worldImportDialog.input = data;
                } else if (type === 'friend') {
                    this.showFriendImportDialog();
                    this.friendImportDialog.input = data;
                }
                break;
        }
    };

    $app.methods.toggleAvatarCopying = function () {
        API.saveCurrentUser({
            allowAvatarCopying: !API.currentUser.allowAvatarCopying
        }).then((args) => {
            return args;
        });
    };

    // #endregion
    // #region | App: Previous Instances User Dialog

    $app.data.previousInstancesUserDialogTable = {
        data: [],
        filters: [
            {
                prop: 'name',
                value: ''
            }
        ],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'created_at',
                order: 'descending'
            }
        },
        pageSize: 10,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [10, 25, 50, 100]
        }
    };

    $app.data.previousInstancesUserDialog = {
        visible: false,
        loading: false,
        forceUpdate: 0,
        userRef: {}
    };

    $app.methods.showPreviousInstancesUserDialog = function (userRef) {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.previousInstancesUserDialog.$el)
        );
        var D = this.previousInstancesUserDialog;
        D.userRef = userRef;
        D.visible = true;
        D.loading = true;
        this.refreshPreviousInstancesUserTable();
    };

    $app.methods.refreshPreviousInstancesUserTable = function () {
        var D = this.previousInstancesUserDialog;
        database.getpreviousInstancesByUserId(D.userRef).then((data) => {
            var array = [];
            for (var ref of data.values()) {
                ref.$location = API.parseLocation(ref.location);
                if (ref.time > 0) {
                    ref.timer = timeToText(ref.time);
                } else {
                    ref.timer = '';
                }
                array.push(ref);
            }
            array.sort(compareByCreatedAt);
            this.previousInstancesUserDialogTable.data = array;
            D.loading = false;
            workerTimers.setTimeout(() => D.forceUpdate++, 150);
        });
    };

    $app.methods.getDisplayNameFromUserId = function (userId) {
        var displayName = userId;
        var ref = API.cachedUsers.get(userId);
        if (
            typeof ref !== 'undefined' &&
            typeof ref.displayName !== 'undefined'
        ) {
            displayName = ref.displayName;
        }
        return displayName;
    };

    $app.methods.confirmDeleteGameLogUserInstance = function (row) {
        this.$confirm('Continue? Delete', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    database.deleteGameLogInstance({
                        id: this.previousInstancesUserDialog.userRef.id,
                        displayName:
                            this.previousInstancesUserDialog.userRef
                                .displayName,
                        location: row.location
                    });
                    removeFromArray(
                        this.previousInstancesUserDialogTable.data,
                        row
                    );
                }
            }
        });
    };

    // #endregion
    // #region | App: Previous Instances World Dialog

    $app.data.previousInstancesWorldDialogTable = {
        data: [],
        filters: [
            {
                prop: 'name',
                value: ''
            }
        ],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'created_at',
                order: 'descending'
            }
        },
        pageSize: 10,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [10, 25, 50, 100]
        }
    };

    $app.data.previousInstancesWorldDialog = {
        visible: false,
        loading: false,
        forceUpdate: 0,
        worldRef: {}
    };

    $app.methods.showPreviousInstancesWorldDialog = function (worldRef) {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.previousInstancesWorldDialog.$el)
        );
        var D = this.previousInstancesWorldDialog;
        D.worldRef = worldRef;
        D.visible = true;
        D.loading = true;
        this.refreshPreviousInstancesWorldTable();
    };

    $app.methods.refreshPreviousInstancesWorldTable = function () {
        var D = this.previousInstancesWorldDialog;
        database.getpreviousInstancesByWorldId(D.worldRef).then((data) => {
            var array = [];
            for (var ref of data.values()) {
                ref.$location = API.parseLocation(ref.location);
                if (ref.time > 0) {
                    ref.timer = timeToText(ref.time);
                } else {
                    ref.timer = '';
                }
                array.push(ref);
            }
            array.sort(compareByCreatedAt);
            this.previousInstancesWorldDialogTable.data = array;
            D.loading = false;
            workerTimers.setTimeout(() => D.forceUpdate++, 150);
        });
    };

    $app.methods.confirmDeleteGameLogWorldInstance = function (row) {
        this.$confirm('Continue? Delete', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    database.deleteGameLogInstanceByInstanceId({
                        location: row.location
                    });
                    removeFromArray(
                        this.previousInstancesWorldDialogTable.data,
                        row
                    );
                }
            }
        });
    };

    // #endregion
    // #region | App: Previous Instance Info Dialog

    $app.data.previousInstanceInfoDialogTable = {
        data: [],
        filters: [
            {
                prop: 'displayName',
                value: ''
            }
        ],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'created_at',
                order: 'descending'
            }
        },
        pageSize: 10,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [10, 25, 50, 100]
        }
    };

    $app.data.previousInstanceInfoDialog = {
        visible: false,
        loading: false,
        forceUpdate: 0,
        $location: {}
    };

    $app.methods.showPreviousInstanceInfoDialog = function (instanceId) {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.previousInstanceInfoDialog.$el)
        );
        var D = this.previousInstanceInfoDialog;
        D.$location = API.parseLocation(instanceId);
        D.visible = true;
        D.loading = true;
        this.refreshPreviousInstanceInfoTable();
    };

    $app.methods.refreshPreviousInstanceInfoTable = function () {
        var D = this.previousInstanceInfoDialog;
        database.getPlayersFromInstance(D.$location.tag).then((data) => {
            var array = [];
            for (var entry of Array.from(data.values())) {
                entry.timer = timeToText(entry.time);
                array.push(entry);
            }
            array.sort(compareByCreatedAt);
            this.previousInstanceInfoDialogTable.data = array;
            D.loading = false;
            workerTimers.setTimeout(() => D.forceUpdate++, 150);
        });
    };

    $app.data.dtHour12 = await configRepository.getBool('VRCX_dtHour12', false);
    $app.data.dtIsoFormat = await configRepository.getBool(
        'VRCX_dtIsoFormat',
        false
    );
    $app.methods.setDatetimeFormat = async function () {
        var currentCulture = await AppApi.CurrentCulture();
        var hour12 = await configRepository.getBool('VRCX_dtHour12');
        var isoFormat = await configRepository.getBool('VRCX_dtIsoFormat');
        if (typeof this.dtHour12 !== 'undefined') {
            if (hour12 !== this.dtHour12) {
                await configRepository.setBool('VRCX_dtHour12', this.dtHour12);
                this.updateVRConfigVars();
            }
            var hour12 = this.dtHour12;
        }
        if (typeof this.dtIsoFormat !== 'undefined') {
            if (isoFormat !== this.dtIsoFormat) {
                await configRepository.setBool(
                    'VRCX_dtIsoFormat',
                    this.dtIsoFormat
                );
            }
            var isoFormat = this.dtIsoFormat;
        }
        var formatDate1 = function (date, format) {
            if (!date) {
                return '-';
            }
            var dt = new Date(date);
            if (format === 'long') {
                return dt.toLocaleDateString(currentCulture, {
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hourCycle: hour12 ? 'h12' : 'h23'
                });
            } else if (format === 'short') {
                return dt
                    .toLocaleDateString(currentCulture, {
                        month: '2-digit',
                        day: '2-digit',
                        hour: 'numeric',
                        minute: 'numeric',
                        hourCycle: hour12 ? 'h12' : 'h23'
                    })
                    .replace(' AM', 'am')
                    .replace(' PM', 'pm')
                    .replace(',', '');
            }
            return '-';
        };
        if (isoFormat) {
            formatDate1 = function (date, format) {
                if (!date) {
                    return '-';
                }
                var dt = new Date(date);
                if (format === 'long') {
                    return dt.toISOString();
                } else if (format === 'short') {
                    return dt
                        .toLocaleDateString('en-nz', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: 'numeric',
                            minute: 'numeric',
                            hourCycle: hour12 ? 'h12' : 'h23'
                        })
                        .replace(' AM', 'am')
                        .replace(' PM', 'pm')
                        .replace(',', '');
                }
                return '-';
            };
        }
        Vue.filter('formatDate', formatDate1);
    };
    $app.methods.setDatetimeFormat();

    $app.data.enableCustomEndpoint = await configRepository.getBool(
        'VRCX_enableCustomEndpoint',
        false
    );
    $app.methods.toggleCustomEndpoint = async function () {
        await configRepository.setBool(
            'VRCX_enableCustomEndpoint',
            this.enableCustomEndpoint
        );
        this.loginForm.endpoint = '';
        this.loginForm.websocket = '';
    };

    $app.data.mouseDownClass = [];
    $app.data.mouseUpClass = [];
    $app.methods.dialogMouseDown = function (e) {
        this.mouseDownClass = [...e.target.classList];
    };
    $app.methods.dialogMouseUp = function (e) {
        this.mouseUpClass = [...e.target.classList];
    };
    $app.methods.beforeDialogClose = function (done) {
        if (
            this.mouseDownClass.includes('el-dialog__wrapper') &&
            this.mouseUpClass.includes('el-dialog__wrapper')
        ) {
            done();
        } else if (
            this.mouseDownClass.includes('el-dialog__close') &&
            this.mouseUpClass.includes('el-dialog__close')
        ) {
            done();
        }
    };

    $app.methods.disableGameLogDialog = async function () {
        if (this.isGameRunning) {
            this.$message({
                message:
                    'VRChat needs to be closed before this option can be changed',
                type: 'error'
            });
            this.gameLogDisabled = !this.gameLogDisabled;
            return;
        }
        if (this.gameLogDisabled) {
            this.$confirm('Continue? Disable GameLog', 'Confirm', {
                confirmButtonText: 'Confirm',
                cancelButtonText: 'Cancel',
                type: 'info',
                callback: async (action) => {
                    if (action !== 'confirm') {
                        this.gameLogDisabled = !this.gameLogDisabled;
                        await configRepository.setBool(
                            'VRCX_gameLogDisabled',
                            this.gameLogDisabled
                        );
                    }
                }
            });
        } else {
            await configRepository.setBool(
                'VRCX_gameLogDisabled',
                this.gameLogDisabled
            );
        }
    };

    $app.methods.getNameColour = async function (userId) {
        var hue = await AppApi.GetColourFromUserID(userId);
        return this.HueToHex(hue);
    };

    $app.methods.userColourInit = async function () {
        var dictObject = await AppApi.GetColourBulk(
            Array.from(API.cachedUsers.keys())
        );
        for (var [userId, hue] of Object.entries(dictObject)) {
            var ref = API.cachedUsers.get(userId);
            if (typeof ref !== 'undefined') {
                ref.$userColour = this.HueToHex(hue);
            }
        }
    };

    $app.methods.HueToHex = function (hue) {
        // this.HSVtoRGB(hue / 65535, .8, .8);
        if (this.isDarkMode) {
            return this.HSVtoRGB(hue / 65535, 0.6, 1);
        }
        return this.HSVtoRGB(hue / 65535, 1, 0.7);
    };

    $app.methods.HSVtoRGB = function (h, s, v) {
        var r = 0;
        var g = 0;
        var b = 0;
        if (arguments.length === 1) {
            var s = h.s;
            var v = h.v;
            var h = h.h;
        }
        var i = Math.floor(h * 6);
        var f = h * 6 - i;
        var p = v * (1 - s);
        var q = v * (1 - f * s);
        var t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0:
                r = v;
                g = t;
                b = p;
                break;
            case 1:
                r = q;
                g = v;
                b = p;
                break;
            case 2:
                r = p;
                g = v;
                b = t;
                break;
            case 3:
                r = p;
                g = q;
                b = v;
                break;
            case 4:
                r = t;
                g = p;
                b = v;
                break;
            case 5:
                r = v;
                g = p;
                b = q;
                break;
        }
        var red = Math.round(r * 255);
        var green = Math.round(g * 255);
        var blue = Math.round(b * 255);
        var decColor = 0x1000000 + blue + 0x100 * green + 0x10000 * red;
        return `#${decColor.toString(16).substr(1)}`;
    };

    $app.methods.isFriendOnline = function (friend) {
        if (
            typeof friend === 'undefined' ||
            typeof friend.ref === 'undefined'
        ) {
            return false;
        }
        if (friend.state === 'online') {
            return true;
        }
        if (friend.state !== 'online' && friend.ref.location !== 'private') {
            // wat
            return true;
        }
        return false;
    };

    $app.methods.isRealInstance = function (instanceId) {
        switch (instanceId) {
            case 'offline':
            case 'private':
            case 'traveling':
            case instanceId.startsWith('local'):
            case '':
                return false;
        }
        return true;
    };

    $app.methods.onPlayerTraveling = function (ref) {
        if (
            !this.isGameRunning ||
            !this.lastLocation.location ||
            this.lastLocation.location !== ref.travelingToLocation ||
            ref.id === API.currentUser.id ||
            this.lastLocation.playerList.has(ref.displayName)
        ) {
            return;
        }

        var onPlayerJoining = {
            created_at: new Date(ref.created_at).toJSON(),
            userId: ref.id,
            displayName: ref.displayName,
            type: 'OnPlayerJoining'
        };
        this.queueFeedNoty(onPlayerJoining);
    };

    $app.methods.updateCurrentUserLocation = function () {
        API.currentUser.$travelingToTime = this.lastLocationDestinationTime;
        var ref = API.cachedUsers.get(API.currentUser.id);
        if (typeof ref === 'undefined') {
            return;
        }

        // update cached user with both gameLog and API locations
        var currentLocation = API.currentUser.$locationTag;
        if (API.currentUser.$location === 'traveling') {
            currentLocation = API.currentUser.$travelingToLocation;
        }
        ref.location = API.currentUser.$locationTag;
        ref.travelingToLocation = API.currentUser.$travelingToLocation;

        if (
            this.isGameRunning &&
            !this.gameLogDisabled &&
            this.lastLocation.location !== ''
        ) {
            // use gameLog instead of API when game is running
            currentLocation = this.lastLocation.location;
            if (this.lastLocation.location === 'traveling') {
                currentLocation = this.lastLocationDestination;
            }
            ref.location = this.lastLocation.location;
            ref.travelingToLocation = this.lastLocationDestination;
        }

        ref.$online_for = API.currentUser.$online_for;
        ref.$offline_for = API.currentUser.$offline_for;
        ref.$location = API.parseLocation(currentLocation);
        if (!this.isGameRunning || this.gameLogDisabled) {
            ref.$location_at = API.currentUser.$location_at;
            ref.$travelingToTime = API.currentUser.$travelingToTime;
            this.applyUserDialogLocation();
            this.applyWorldDialogInstances();
            this.applyGroupDialogInstances();
        } else {
            ref.$location_at = this.lastLocation.date;
            ref.$travelingToTime = this.lastLocationDestinationTime;
        }
    };

    $app.methods.setCurrentUserLocation = function (location) {
        API.currentUser.$location_at = Date.now();
        API.currentUser.$travelingToTime = Date.now();
        API.currentUser.$locationTag = location;
        this.updateCurrentUserLocation();
    };

    $app.data.avatarHistory = new Set();
    $app.data.avatarHistoryArray = [];

    $app.methods.getAvatarHistory = async function () {
        this.avatarHistory = new Set();
        var historyArray = await database.getAvatarHistory(API.currentUser.id);
        this.avatarHistoryArray = historyArray;
        for (var i = 0; i < historyArray.length; i++) {
            this.avatarHistory.add(historyArray[i].id);
            API.applyAvatar(historyArray[i]);
        }
    };

    $app.methods.addAvatarToHistory = function (avatarId) {
        API.getAvatar({ avatarId }).then((args) => {
            var { ref } = args;
            if (ref.authorId === API.currentUser.id) {
                return;
            }
            var historyArray = this.avatarHistoryArray;
            for (var i = 0; i < historyArray.length; ++i) {
                if (historyArray[i].id === ref.id) {
                    historyArray.splice(i, 1);
                }
            }
            this.avatarHistoryArray.unshift(ref);
            database.addAvatarToCache(ref);

            this.avatarHistory.delete(ref.id);
            this.avatarHistory.add(ref.id);
            database.addAvatarToHistory(ref.id);
        });
    };

    $app.methods.promptClearAvatarHistory = function () {
        this.$confirm('Continue? Clear Avatar History', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    this.clearAvatarHistory();
                }
            }
        });
    };

    $app.methods.clearAvatarHistory = function () {
        this.avatarHistory = new Set();
        this.avatarHistoryArray = [];
        database.clearAvatarHistory();
    };

    $app.data.databaseVersion = await configRepository.getInt(
        'VRCX_databaseVersion',
        0
    );

    $app.methods.updateDatabaseVersion = async function () {
        var databaseVersion = 7;
        if (this.databaseVersion < databaseVersion) {
            if (this.databaseVersion) {
                var msgBox = this.$message({
                    message:
                        'DO NOT CLOSE VRCX, database upgrade in progress...',
                    type: 'warning',
                    duration: 0
                });
            }
            console.log(
                `Updating database from ${this.databaseVersion} to ${databaseVersion}...`
            );
            try {
                await database.cleanLegendFromFriendLog(); // fix friendLog spammed with crap
                await database.fixGameLogTraveling(); // fix bug with gameLog location being set as traveling
                await database.fixNegativeGPS(); // fix GPS being a negative value due to VRCX bug with traveling
                await database.fixBrokenLeaveEntries(); // fix user instance timer being higher than current user location timer
                await database.fixBrokenGroupInvites(); // fix notification v2 in wrong table
                await database.updateTableForGroupNames(); // alter tables to include group name
                await database.fixBrokenNotifications(); // fix notifications being null
                await database.vacuum(); // succ
                await database.setWal(); // https://www.sqlite.org/wal.html
                await configRepository.setInt(
                    'VRCX_databaseVersion',
                    databaseVersion
                );
                console.log('Database update complete.');
                msgBox?.close();
                if (this.databaseVersion) {
                    // only display when database exists
                    this.$message({
                        message: 'Database upgrade complete',
                        type: 'success'
                    });
                }
                this.databaseVersion = databaseVersion;
            } catch (err) {
                console.error(err);
                msgBox?.close();
                this.$message({
                    message:
                        'Database upgrade failed, check console for details',
                    type: 'error',
                    duration: 120000
                });
                AppApi.ShowDevTools();
            }
        }
    };

    // #endregion
    // #region | App: world favorite import

    $app.data.worldImportDialog = {
        visible: false,
        loading: false,
        progress: 0,
        progressTotal: 0,
        input: '',
        worldIdList: new Set(),
        errors: '',
        worldImportFavoriteGroup: null,
        worldImportLocalFavoriteGroup: null,
        importProgress: 0,
        importProgressTotal: 0
    };

    $app.data.worldImportTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table'
    };

    $app.methods.showWorldImportDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.worldImportDialog.$el));
        var D = this.worldImportDialog;
        this.resetWorldImport();
        D.visible = true;
    };

    $app.methods.processWorldImportList = async function () {
        var D = this.worldImportDialog;
        D.loading = true;
        var regexWorldId =
            /wrld_[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}/g;
        var match = [];
        var worldIdList = new Set();
        while ((match = regexWorldId.exec(D.input)) !== null) {
            worldIdList.add(match[0]);
        }
        D.input = '';
        D.errors = '';
        D.progress = 0;
        D.progressTotal = worldIdList.size;
        var data = Array.from(worldIdList);
        for (var i = 0; i < data.length; ++i) {
            if (!D.visible) {
                this.resetWorldImport();
            }
            if (!D.loading || !D.visible) {
                break;
            }
            var worldId = data[i];
            if (!D.worldIdList.has(worldId)) {
                try {
                    var args = await API.getWorld({
                        worldId
                    });
                    this.worldImportTable.data.push(args.ref);
                    D.worldIdList.add(worldId);
                } catch (err) {
                    D.errors = D.errors.concat(
                        `WorldId: ${worldId}\n${err}\n\n`
                    );
                }
            }
            D.progress++;
            if (D.progress === worldIdList.size) {
                D.progress = 0;
            }
        }
        D.loading = false;
    };

    $app.methods.deleteItemWorldImport = function (ref) {
        var D = this.worldImportDialog;
        removeFromArray(this.worldImportTable.data, ref);
        D.worldIdList.delete(ref.id);
    };

    $app.methods.resetWorldImport = function () {
        var D = this.worldImportDialog;
        D.input = '';
        D.errors = '';
    };

    $app.methods.clearWorldImportTable = function () {
        var D = this.worldImportDialog;
        this.worldImportTable.data = [];
        D.worldIdList = new Set();
    };

    $app.methods.selectWorldImportGroup = function (group) {
        var D = this.worldImportDialog;
        D.worldImportLocalFavoriteGroup = null;
        D.worldImportFavoriteGroup = group;
    };

    $app.methods.selectWorldImportLocalGroup = function (group) {
        var D = this.worldImportDialog;
        D.worldImportFavoriteGroup = null;
        D.worldImportLocalFavoriteGroup = group;
    };

    $app.methods.cancelWorldImport = function () {
        var D = this.worldImportDialog;
        D.loading = false;
    };

    $app.methods.importWorldImportTable = async function () {
        var D = this.worldImportDialog;
        if (!D.worldImportFavoriteGroup && !D.worldImportLocalFavoriteGroup) {
            return;
        }
        D.loading = true;
        var data = [...this.worldImportTable.data].reverse();
        D.importProgressTotal = data.length;
        try {
            for (var i = data.length - 1; i >= 0; i--) {
                if (!D.loading || !D.visible) {
                    break;
                }
                var ref = data[i];
                if (D.worldImportFavoriteGroup) {
                    await this.addFavoriteWorld(
                        ref,
                        D.worldImportFavoriteGroup
                    );
                } else if (D.worldImportLocalFavoriteGroup) {
                    this.addLocalWorldFavorite(
                        ref.id,
                        D.worldImportLocalFavoriteGroup
                    );
                }
                removeFromArray(this.worldImportTable.data, ref);
                D.worldIdList.delete(ref.id);
                D.importProgress++;
            }
        } catch (err) {
            D.errors = `Name: ${ref.name}\nWorldId: ${ref.id}\n${err}\n\n`;
        } finally {
            D.importProgress = 0;
            D.importProgressTotal = 0;
            D.loading = false;
        }
    };

    API.$on('LOGIN', function () {
        $app.clearWorldImportTable();
        $app.resetWorldImport();
        $app.worldImportDialog.visible = false;
        $app.worldImportFavoriteGroup = null;
        $app.worldImportLocalFavoriteGroup = null;

        $app.worldExportDialogVisible = false;
        $app.worldExportFavoriteGroup = null;
        $app.worldExportLocalFavoriteGroup = null;
    });

    // #endregion
    // #region | App: world favorite export

    $app.data.worldExportDialogRef = {};
    $app.data.worldExportDialogVisible = false;
    $app.data.worldExportContent = '';
    $app.data.worldExportFavoriteGroup = null;
    $app.data.worldExportLocalFavoriteGroup = null;

    $app.methods.showWorldExportDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.worldExportDialogRef.$el)
        );
        this.worldExportFavoriteGroup = null;
        this.worldExportLocalFavoriteGroup = null;
        this.updateWorldExportDialog();
        this.worldExportDialogVisible = true;
    };

    $app.methods.updateWorldExportDialog = function () {
        var _ = function (str) {
            if (/[\x00-\x1f,"]/.test(str) === true) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        var lines = ['WorldID,Name'];
        if (this.worldExportFavoriteGroup) {
            API.favoriteWorldGroups.forEach((group) => {
                if (this.worldExportFavoriteGroup === group) {
                    $app.favoriteWorlds.forEach((ref) => {
                        if (group.key === ref.groupKey) {
                            lines.push(`${_(ref.id)},${_(ref.name)}`);
                        }
                    });
                }
            });
        } else if (this.worldExportLocalFavoriteGroup) {
            var favoriteGroup =
                this.localWorldFavorites[this.worldExportLocalFavoriteGroup];
            if (!favoriteGroup) {
                return;
            }
            for (var i = 0; i < favoriteGroup.length; ++i) {
                var ref = favoriteGroup[i];
                lines.push(`${_(ref.id)},${_(ref.name)}`);
            }
        } else {
            // export all
            this.favoriteWorlds.forEach((ref1) => {
                lines.push(`${_(ref1.id)},${_(ref1.name)}`);
            });
            for (var i = 0; i < this.localWorldFavoritesList.length; ++i) {
                var worldId = this.localWorldFavoritesList[i];
                var ref2 = API.cachedWorlds.get(worldId);
                if (typeof ref2 !== 'undefined') {
                    lines.push(`${_(ref2.id)},${_(ref2.name)}`);
                }
            }
        }
        this.worldExportContent = lines.join('\n');
    };

    $app.methods.selectWorldExportGroup = function (group) {
        this.worldExportFavoriteGroup = group;
        this.worldExportLocalFavoriteGroup = null;
        this.updateWorldExportDialog();
    };

    $app.methods.selectWorldExportLocalGroup = function (group) {
        this.worldExportLocalFavoriteGroup = group;
        this.worldExportFavoriteGroup = null;
        this.updateWorldExportDialog();
    };

    // #endregion
    // #region | App: avatar favorite import

    $app.data.avatarImportDialog = {
        visible: false,
        loading: false,
        progress: 0,
        progressTotal: 0,
        input: '',
        avatarIdList: new Set(),
        errors: '',
        avatarImportFavoriteGroup: null,
        importProgress: 0,
        importProgressTotal: 0
    };

    $app.data.avatarImportTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table'
    };

    $app.methods.showAvatarImportDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.avatarImportDialog.$el));
        var D = this.avatarImportDialog;
        this.resetAvatarImport();
        D.visible = true;
    };

    $app.methods.processAvatarImportList = async function () {
        var D = this.avatarImportDialog;
        D.loading = true;
        var regexAvatarId =
            /avtr_[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}/g;
        var match = [];
        var avatarIdList = new Set();
        while ((match = regexAvatarId.exec(D.input)) !== null) {
            avatarIdList.add(match[0]);
        }
        D.input = '';
        D.errors = '';
        D.progress = 0;
        D.progressTotal = avatarIdList.size;
        var data = Array.from(avatarIdList);
        for (var i = 0; i < data.length; ++i) {
            if (!D.visible) {
                this.resetAvatarImport();
            }
            if (!D.loading || !D.visible) {
                break;
            }
            var avatarId = data[i];
            if (!D.avatarIdList.has(avatarId)) {
                try {
                    var args = await API.getAvatar({
                        avatarId
                    });
                    this.avatarImportTable.data.push(args.ref);
                    D.avatarIdList.add(avatarId);
                } catch (err) {
                    D.errors = D.errors.concat(
                        `AvatarId: ${avatarId}\n${err}\n\n`
                    );
                }
            }
            D.progress++;
            if (D.progress === avatarIdList.size) {
                D.progress = 0;
            }
        }
        D.loading = false;
    };

    $app.methods.deleteItemAvatarImport = function (ref) {
        var D = this.avatarImportDialog;
        removeFromArray(this.avatarImportTable.data, ref);
        D.avatarIdList.delete(ref.id);
    };

    $app.methods.resetAvatarImport = function () {
        var D = this.avatarImportDialog;
        D.input = '';
        D.errors = '';
    };

    $app.methods.clearAvatarImportTable = function () {
        var D = this.avatarImportDialog;
        this.avatarImportTable.data = [];
        D.avatarIdList = new Set();
    };

    $app.methods.selectAvatarImportGroup = function (group) {
        var D = this.avatarImportDialog;
        D.avatarImportFavoriteGroup = group;
    };

    $app.methods.cancelAvatarImport = function () {
        var D = this.avatarImportDialog;
        D.loading = false;
    };

    $app.methods.importAvatarImportTable = async function () {
        var D = this.avatarImportDialog;
        D.loading = true;
        if (!D.avatarImportFavoriteGroup) {
            return;
        }
        var data = [...this.avatarImportTable.data].reverse();
        D.importProgressTotal = data.length;
        try {
            for (var i = data.length - 1; i >= 0; i--) {
                if (!D.loading || !D.visible) {
                    break;
                }
                var ref = data[i];
                await this.addFavoriteAvatar(ref, D.avatarImportFavoriteGroup);
                removeFromArray(this.avatarImportTable.data, ref);
                D.avatarIdList.delete(ref.id);
                D.importProgress++;
            }
        } catch (err) {
            D.errors = `Name: ${ref.name}\nAvatarId: ${ref.id}\n${err}\n\n`;
        } finally {
            D.importProgress = 0;
            D.importProgressTotal = 0;
            D.loading = false;
        }
    };

    API.$on('LOGIN', function () {
        $app.clearAvatarImportTable();
        $app.resetAvatarImport();
        $app.avatarImportDialog.visible = false;
        $app.avatarImportFavoriteGroup = null;

        $app.avatarExportDialogVisible = false;
        $app.avatarExportFavoriteGroup = null;
    });

    // #endregion
    // #region | App: avatar favorite export

    $app.data.avatarExportDialogRef = {};
    $app.data.avatarExportDialogVisible = false;
    $app.data.avatarExportContent = '';
    $app.data.avatarExportFavoriteGroup = null;

    $app.methods.showAvatarExportDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.avatarExportDialogRef.$el)
        );
        this.avatarExportFavoriteGroup = null;
        this.updateAvatarExportDialog();
        this.avatarExportDialogVisible = true;
    };

    $app.methods.updateAvatarExportDialog = function () {
        var _ = function (str) {
            if (/[\x00-\x1f,"]/.test(str) === true) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        var lines = ['AvatarID,Name'];
        API.favoriteAvatarGroups.forEach((group) => {
            if (
                !this.avatarExportFavoriteGroup ||
                this.avatarExportFavoriteGroup === group
            ) {
                $app.favoriteAvatars.forEach((ref) => {
                    if (group.key === ref.groupKey) {
                        lines.push(`${_(ref.id)},${_(ref.name)}`);
                    }
                });
            }
        });
        this.avatarExportContent = lines.join('\n');
    };

    $app.methods.selectAvatarExportGroup = function (group) {
        this.avatarExportFavoriteGroup = group;
        this.updateAvatarExportDialog();
    };

    // #endregion
    // #region | App: friend favorite import

    $app.data.friendImportDialog = {
        visible: false,
        loading: false,
        progress: 0,
        progressTotal: 0,
        input: '',
        userIdList: new Set(),
        errors: '',
        friendImportFavoriteGroup: null,
        importProgress: 0,
        importProgressTotal: 0
    };

    $app.data.friendImportTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table'
    };

    $app.methods.showFriendImportDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.friendImportDialog.$el));
        var D = this.friendImportDialog;
        this.resetFriendImport();
        D.visible = true;
    };

    $app.methods.processFriendImportList = async function () {
        var D = this.friendImportDialog;
        D.loading = true;
        var regexFriendId =
            /usr_[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}/g;
        var match = [];
        var userIdList = new Set();
        while ((match = regexFriendId.exec(D.input)) !== null) {
            userIdList.add(match[0]);
        }
        D.input = '';
        D.errors = '';
        D.progress = 0;
        D.progressTotal = userIdList.size;
        var data = Array.from(userIdList);
        for (var i = 0; i < data.length; ++i) {
            if (!D.visible) {
                this.resetFriendImport();
            }
            if (!D.loading || !D.visible) {
                break;
            }
            var userId = data[i];
            if (!D.userIdList.has(userId)) {
                try {
                    var args = await API.getUser({
                        userId
                    });
                    this.friendImportTable.data.push(args.ref);
                    D.userIdList.add(userId);
                } catch (err) {
                    D.errors = D.errors.concat(`UserId: ${userId}\n${err}\n\n`);
                }
            }
            D.progress++;
            if (D.progress === userIdList.size) {
                D.progress = 0;
            }
        }
        D.loading = false;
    };

    $app.methods.deleteItemFriendImport = function (ref) {
        var D = this.friendImportDialog;
        removeFromArray(this.friendImportTable.data, ref);
        D.userIdList.delete(ref.id);
    };

    $app.methods.resetFriendImport = function () {
        var D = this.friendImportDialog;
        D.input = '';
        D.errors = '';
    };

    $app.methods.clearFriendImportTable = function () {
        var D = this.friendImportDialog;
        this.friendImportTable.data = [];
        D.userIdList = new Set();
    };

    $app.methods.selectFriendImportGroup = function (group) {
        var D = this.friendImportDialog;
        D.friendImportFavoriteGroup = group;
    };

    $app.methods.cancelFriendImport = function () {
        var D = this.friendImportDialog;
        D.loading = false;
    };

    $app.methods.importFriendImportTable = async function () {
        var D = this.friendImportDialog;
        D.loading = true;
        if (!D.friendImportFavoriteGroup) {
            return;
        }
        var data = [...this.friendImportTable.data].reverse();
        D.importProgressTotal = data.length;
        try {
            for (var i = data.length - 1; i >= 0; i--) {
                if (!D.loading || !D.visible) {
                    break;
                }
                var ref = data[i];
                await this.addFavoriteUser(ref, D.friendImportFavoriteGroup);
                removeFromArray(this.friendImportTable.data, ref);
                D.userIdList.delete(ref.id);
                D.importProgress++;
            }
        } catch (err) {
            D.errors = `Name: ${ref.displayName}\nUserId: ${ref.id}\n${err}\n\n`;
        } finally {
            D.importProgress = 0;
            D.importProgressTotal = 0;
            D.loading = false;
        }
    };

    API.$on('LOGIN', function () {
        $app.clearFriendImportTable();
        $app.resetFriendImport();
        $app.friendImportDialog.visible = false;
        $app.friendImportFavoriteGroup = null;

        $app.friendExportDialogVisible = false;
        $app.friendExportFavoriteGroup = null;
    });

    // #endregion
    // #region | App: friend favorite export

    $app.data.friendExportDialogRef = {};
    $app.data.friendExportDialogVisible = false;
    $app.data.friendExportContent = '';
    $app.data.friendExportFavoriteGroup = null;

    $app.methods.showFriendExportDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.friendExportDialogRef.$el)
        );
        this.friendExportFavoriteGroup = null;
        this.updateFriendExportDialog();
        this.friendExportDialogVisible = true;
    };

    $app.methods.updateFriendExportDialog = function () {
        var _ = function (str) {
            if (/[\x00-\x1f,"]/.test(str) === true) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        var lines = ['UserID,Name'];
        API.favoriteFriendGroups.forEach((group) => {
            if (
                !this.friendExportFavoriteGroup ||
                this.friendExportFavoriteGroup === group
            ) {
                $app.favoriteFriends.forEach((ref) => {
                    if (group.key === ref.groupKey) {
                        lines.push(`${_(ref.id)},${_(ref.name)}`);
                    }
                });
            }
        });
        this.friendExportContent = lines.join('\n');
    };

    $app.methods.selectFriendExportGroup = function (group) {
        this.friendExportFavoriteGroup = group;
        this.updateFriendExportDialog();
    };

    // #endregion
    // #region | App: user dialog notes

    API.saveNote = function (params) {
        return this.call('userNotes', {
            method: 'POST',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('NOTE', args);
            return args;
        });
    };

    API.$on('NOTE', function (args) {
        var note = '';
        var targetUserId = '';
        if (typeof args.json !== 'undefined') {
            note = $app.replaceBioSymbols(args.json.note);
        }
        if (typeof args.params !== 'undefined') {
            targetUserId = args.params.targetUserId;
        }
        if (targetUserId === $app.userDialog.id) {
            if (note === args.params.note) {
                $app.userDialog.noteSaving = false;
                $app.userDialog.note = note;
            } else {
                // response is cached sadge :<
                this.getUser({ userId: targetUserId });
            }
        }
        var ref = API.cachedUsers.get(targetUserId);
        if (typeof ref !== 'undefined') {
            ref.note = note;
        }
    });

    $app.methods.checkNote = function (ref, note) {
        if (ref.note !== note) {
            this.addNote(ref.id, note);
        }
    };

    $app.methods.cleanNote = function (note) {
        // remove newlines because they aren't supported
        $app.userDialog.note = note.replace(/[\r\n]/g, '');
    };

    $app.methods.addNote = function (userId, note) {
        if (this.userDialog.id === userId) {
            this.userDialog.noteSaving = true;
        }
        return API.saveNote({
            targetUserId: userId,
            note
        });
    };

    $app.methods.deleteNote = function (userId) {
        if (this.userDialog.id === userId) {
            this.userDialog.noteSaving = true;
        }
        return API.saveNote({
            targetUserId: userId,
            note: ''
        });
    };

    // #endregion
    // #region | App: note export

    $app.data.noteExportDialog = {
        visible: false,
        loading: false,
        progress: 0,
        progressTotal: 0,
        errors: ''
    };
    $app.data.noteExportTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        layout: 'table'
    };

    API.$on('LOGIN', function () {
        $app.noteExportTable.data = [];
        $app.noteExportDialog.visible = false;
        $app.noteExportDialog.loading = false;
        $app.noteExportDialog.progress = 0;
        $app.noteExportDialog.progressTotal = 0;
        $app.noteExportDialog.errors = '';
    });

    $app.methods.showNoteExportDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.noteExportDialog.$el));
        var D = this.noteExportDialog;
        D.progress = 0;
        D.progressTotal = 0;
        D.loading = false;
        D.visible = true;
    };

    $app.methods.updateNoteExportDialog = function () {
        var data = [];
        this.friends.forEach((ctx) => {
            var newMemo = ctx.memo.replace(/[\r\n]/g, ' ');
            if (ctx.memo && ctx.ref && ctx.ref.note !== newMemo.slice(0, 256)) {
                data.push({
                    id: ctx.id,
                    name: ctx.name,
                    memo: newMemo,
                    ref: ctx.ref
                });
            }
        });
        this.noteExportTable.data = data;
    };

    $app.methods.removeFromNoteExportTable = function (ref) {
        removeFromArray(this.noteExportTable.data, ref);
    };

    $app.methods.exportNoteExport = async function () {
        var D = this.noteExportDialog;
        D.loading = true;
        var data = [...this.noteExportTable.data].reverse();
        D.progressTotal = data.length;
        try {
            for (var i = data.length - 1; i >= 0; i--) {
                if (D.visible && D.loading) {
                    var ctx = data[i];
                    await API.saveNote({
                        targetUserId: ctx.id,
                        note: ctx.memo.slice(0, 256)
                    });
                    removeFromArray(this.noteExportTable.data, ctx);
                    D.progress++;
                    await new Promise((resolve) => {
                        workerTimers.setTimeout(resolve, 5000);
                    });
                }
            }
        } catch (err) {
            D.errors = `Name: ${ctx.name}\n${err}\n\n`;
        } finally {
            D.progress = 0;
            D.progressTotal = 0;
            D.loading = false;
        }
    };

    $app.methods.cancelNoteExport = function () {
        this.noteExportDialog.loading = false;
    };

    // avatar database provider

    $app.data.avatarProviderDialog = {
        visible: false
    };

    $app.methods.showAvatarProviderDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.avatarProviderDialog.$el)
        );
        var D = this.avatarProviderDialog;
        D.visible = true;
    };

    $app.methods.addAvatarProvider = function (url) {
        if (!url) {
            return;
        }
        this.showAvatarProviderDialog();
        if (!this.avatarRemoteDatabaseProviderList.includes(url)) {
            this.avatarRemoteDatabaseProviderList.push(url);
        }
        this.saveAvatarProviderList();
    };

    $app.methods.removeAvatarProvider = function (url) {
        var length = this.avatarRemoteDatabaseProviderList.length;
        for (var i = 0; i < length; ++i) {
            if (this.avatarRemoteDatabaseProviderList[i] === url) {
                this.avatarRemoteDatabaseProviderList.splice(i, 1);
            }
        }
        this.saveAvatarProviderList();
    };

    $app.methods.saveAvatarProviderList = async function () {
        var length = this.avatarRemoteDatabaseProviderList.length;
        for (var i = 0; i < length; ++i) {
            if (!this.avatarRemoteDatabaseProviderList[i]) {
                this.avatarRemoteDatabaseProviderList.splice(i, 1);
            }
        }
        await configRepository.setString(
            'VRCX_avatarRemoteDatabaseProviderList',
            JSON.stringify(this.avatarRemoteDatabaseProviderList)
        );
        if (this.avatarRemoteDatabaseProviderList.length > 0) {
            this.avatarRemoteDatabaseProvider =
                this.avatarRemoteDatabaseProviderList[0];
            this.avatarRemoteDatabase = true;
        } else {
            this.avatarRemoteDatabaseProvider = '';
            this.avatarRemoteDatabase = false;
        }
        await configRepository.setBool(
            'VRCX_avatarRemoteDatabase',
            this.avatarRemoteDatabase
        );
    };

    $app.methods.setAvatarProvider = function (provider) {
        this.avatarRemoteDatabaseProvider = provider;
    };

    // #endregion
    // #region | App: bulk unfavorite

    $app.data.bulkUnfavoriteMode = false;

    $app.methods.showBulkUnfavoriteSelectionConfirm = function () {
        var elementsTicked = [];
        // check favorites type
        for (var ctx of this.favoriteFriends) {
            if (ctx.$selected) {
                elementsTicked.push(ctx.id);
            }
        }
        for (var ctx of this.favoriteWorlds) {
            if (ctx.$selected) {
                elementsTicked.push(ctx.id);
            }
        }
        for (var ctx of this.favoriteAvatars) {
            if (ctx.$selected) {
                elementsTicked.push(ctx.id);
            }
        }
        if (elementsTicked.length === 0) {
            return;
        }
        this.$confirm(
            `Are you sure you want to unfavorite ${elementsTicked.length} favorites?
            This action cannot be undone.`,
            `Delete ${elementsTicked.length} favorites?`,
            {
                confirmButtonText: 'Confirm',
                cancelButtonText: 'Cancel',
                type: 'info',
                callback: (action) => {
                    if (action === 'confirm') {
                        this.bulkUnfavoriteSelection(elementsTicked);
                    }
                }
            }
        );
    };

    $app.methods.bulkUnfavoriteSelection = function (elementsTicked) {
        for (var id of elementsTicked) {
            API.deleteFavorite({
                objectId: id
            });
        }
        this.bulkUnfavoriteMode = false;
    };

    // #endregion
    // #region | App: local world favorites

    $app.data.localWorldFavoriteGroups = [];
    $app.data.localWorldFavoritesList = [];
    $app.data.localWorldFavorites = {};

    $app.methods.addLocalWorldFavorite = function (worldId, group) {
        if (this.hasLocalWorldFavorite(worldId, group)) {
            return;
        }
        var ref = API.cachedWorlds.get(worldId);
        if (typeof ref === 'undefined') {
            return;
        }
        if (!this.localWorldFavoritesList.includes(worldId)) {
            this.localWorldFavoritesList.push(worldId);
        }
        if (!this.localWorldFavorites[group]) {
            this.localWorldFavorites[group] = [];
        }
        if (!this.localWorldFavoriteGroups.includes(group)) {
            this.localWorldFavoriteGroups.push(group);
        }
        this.localWorldFavorites[group].unshift(ref);
        database.addWorldToCache(ref);
        database.addWorldToFavorites(worldId, group);
        if (
            this.favoriteDialog.visible &&
            this.favoriteDialog.objectId === worldId
        ) {
            this.updateFavoriteDialog(worldId);
        }
        if (this.worldDialog.visible && this.worldDialog.id === worldId) {
            this.worldDialog.isFavorite = true;
        }
    };

    $app.methods.removeLocalWorldFavorite = function (worldId, group) {
        var favoriteGroup = this.localWorldFavorites[group];
        for (var i = 0; i < favoriteGroup.length; ++i) {
            if (favoriteGroup[i].id === worldId) {
                favoriteGroup.splice(i, 1);
            }
        }

        // remove from cache if no longer in favorites
        var worldInFavorites = false;
        for (var i = 0; i < this.localWorldFavoriteGroups.length; ++i) {
            var groupName = this.localWorldFavoriteGroups[i];
            if (!this.localWorldFavorites[groupName] || group === groupName) {
                continue;
            }
            for (
                var j = 0;
                j < this.localWorldFavorites[groupName].length;
                ++j
            ) {
                var id = this.localWorldFavorites[groupName][j].id;
                if (id === worldId) {
                    worldInFavorites = true;
                    break;
                }
            }
        }
        if (!worldInFavorites) {
            removeFromArray(this.localWorldFavoritesList, worldId);
            database.removeWorldFromCache(worldId);
        }
        database.removeWorldFromFavorites(worldId, group);
        if (
            this.favoriteDialog.visible &&
            this.favoriteDialog.objectId === worldId
        ) {
            this.updateFavoriteDialog(worldId);
        }
        if (this.worldDialog.visible && this.worldDialog.id === worldId) {
            this.worldDialog.isFavorite =
                API.cachedFavoritesByObjectId.has(worldId);
        }

        // update UI
        this.sortLocalWorldFavorites();
    };

    $app.methods.getLocalWorldFavorites = async function () {
        this.localWorldFavoriteGroups = [];
        this.localWorldFavoritesList = [];
        this.localWorldFavorites = {};
        var worldCache = await database.getWorldCache();
        for (var i = 0; i < worldCache.length; ++i) {
            var ref = worldCache[i];
            if (!API.cachedWorlds.has(ref.id)) {
                API.applyWorld(ref);
            }
        }
        var favorites = await database.getWorldFavorites();
        for (var i = 0; i < favorites.length; ++i) {
            var favorite = favorites[i];
            if (!this.localWorldFavoritesList.includes(favorite.worldId)) {
                this.localWorldFavoritesList.push(favorite.worldId);
            }
            if (!this.localWorldFavorites[favorite.groupName]) {
                this.localWorldFavorites[favorite.groupName] = [];
            }
            if (!this.localWorldFavoriteGroups.includes(favorite.groupName)) {
                this.localWorldFavoriteGroups.push(favorite.groupName);
            }
            var ref = API.cachedWorlds.get(favorite.worldId);
            if (typeof ref === 'undefined') {
                ref = {
                    id: favorite.worldId
                };
            }
            this.localWorldFavorites[favorite.groupName].unshift(ref);
        }
        if (this.localWorldFavoriteGroups.length === 0) {
            // default group
            this.localWorldFavorites.Favorites = [];
            this.localWorldFavoriteGroups.push('Favorites');
        }
        this.sortLocalWorldFavorites();
    };

    $app.methods.hasLocalWorldFavorite = function (worldId, group) {
        var favoriteGroup = this.localWorldFavorites[group];
        if (!favoriteGroup) {
            return false;
        }
        for (var i = 0; i < favoriteGroup.length; ++i) {
            if (favoriteGroup[i].id === worldId) {
                return true;
            }
        }
        return false;
    };

    $app.methods.getLocalWorldFavoriteGroupLength = function (group) {
        var favoriteGroup = this.localWorldFavorites[group];
        if (!favoriteGroup) {
            return 0;
        }
        return favoriteGroup.length;
    };

    $app.methods.promptNewLocalWorldFavoriteGroup = function () {
        this.$prompt(
            $t('prompt.new_local_favorite_group.description'),
            $t('prompt.new_local_favorite_group.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.new_local_favorite_group.ok'),
                cancelButtonText: $t('prompt.new_local_favorite_group.cancel'),
                inputPattern: /\S+/,
                inputErrorMessage: $t(
                    'prompt.new_local_favorite_group.input_error'
                ),
                callback: (action, instance) => {
                    if (action === 'confirm' && instance.inputValue) {
                        this.newLocalWorldFavoriteGroup(instance.inputValue);
                    }
                }
            }
        );
    };

    $app.methods.newLocalWorldFavoriteGroup = function (group) {
        if (this.localWorldFavoriteGroups.includes(group)) {
            $app.$message({
                message: $t('prompt.new_local_favorite_group.message.error', {
                    name: group
                }),
                type: 'error'
            });
            return;
        }
        if (!this.localWorldFavorites[group]) {
            this.localWorldFavorites[group] = [];
        }
        if (!this.localWorldFavoriteGroups.includes(group)) {
            this.localWorldFavoriteGroups.push(group);
        }
        this.sortLocalWorldFavorites();
    };

    $app.methods.promptLocalWorldFavoriteGroupRename = function (group) {
        this.$prompt(
            $t('prompt.local_favorite_group_rename.description'),
            $t('prompt.local_favorite_group_rename.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t(
                    'prompt.local_favorite_group_rename.save'
                ),
                cancelButtonText: $t(
                    'prompt.local_favorite_group_rename.cancel'
                ),
                inputPattern: /\S+/,
                inputErrorMessage: $t(
                    'prompt.local_favorite_group_rename.input_error'
                ),
                inputValue: group,
                callback: (action, instance) => {
                    if (action === 'confirm' && instance.inputValue) {
                        this.renameLocalWorldFavoriteGroup(
                            instance.inputValue,
                            group
                        );
                    }
                }
            }
        );
    };

    $app.methods.renameLocalWorldFavoriteGroup = function (newName, group) {
        if (this.localWorldFavoriteGroups.includes(newName)) {
            $app.$message({
                message: $t(
                    'prompt.local_favorite_group_rename.message.error',
                    { name: newName }
                ),
                type: 'error'
            });
            return;
        }
        this.localWorldFavoriteGroups.push(newName);
        this.localWorldFavorites[newName] = this.localWorldFavorites[group];

        removeFromArray(this.localWorldFavoriteGroups, group);
        delete this.localWorldFavorites[group];
        database.renameWorldFavoriteGroup(newName, group);
        this.sortLocalWorldFavorites();
    };

    $app.methods.promptLocalWorldFavoriteGroupDelete = function (group) {
        this.$confirm(`Delete Group? ${group}`, 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                if (action === 'confirm') {
                    this.deleteLocalWorldFavoriteGroup(group);
                }
            }
        });
    };

    $app.methods.sortLocalWorldFavorites = function () {
        this.localWorldFavoriteGroups.sort();
        if (!this.sortFavorites) {
            for (var i = 0; i < this.localWorldFavoriteGroups.length; ++i) {
                var group = this.localWorldFavoriteGroups[i];
                if (this.localWorldFavorites[group]) {
                    this.localWorldFavorites[group].sort(compareByName);
                }
            }
        }
    };

    $app.methods.deleteLocalWorldFavoriteGroup = function (group) {
        // remove from cache if no longer in favorites
        var worldIdRemoveList = new Set();
        var favoriteGroup = this.localWorldFavorites[group];
        for (var i = 0; i < favoriteGroup.length; ++i) {
            worldIdRemoveList.add(favoriteGroup[i].id);
        }

        removeFromArray(this.localWorldFavoriteGroups, group);
        delete this.localWorldFavorites[group];
        database.deleteWorldFavoriteGroup(group);

        for (var i = 0; i < this.localWorldFavoriteGroups.length; ++i) {
            var groupName = this.localWorldFavoriteGroups[i];
            if (!this.localWorldFavorites[groupName]) {
                continue;
            }
            for (
                var j = 0;
                j < this.localWorldFavorites[groupName].length;
                ++j
            ) {
                var worldId = this.localWorldFavorites[groupName][j].id;
                if (worldIdRemoveList.has(worldId)) {
                    worldIdRemoveList.delete(worldId);
                    break;
                }
            }
        }

        worldIdRemoveList.forEach((id) => {
            removeFromArray(this.localWorldFavoritesList, id);
            database.removeWorldFromCache(id);
        });
    };

    API.$on('WORLD', function (args) {
        if ($app.localWorldFavoritesList.includes(args.ref.id)) {
            // update db cache
            database.addWorldToCache(args.ref);
        }
    });

    API.$on('LOGIN', function () {
        $app.getLocalWorldFavorites();
    });

    // pending offline timer

    $app.methods.promptSetPendingOffline = function () {
        this.$prompt(
            $t('prompt.pending_offline_delay.description'),
            $t('prompt.pending_offline_delay.header'),
            {
                distinguishCancelAndClose: true,
                confirmButtonText: $t('prompt.pending_offline_delay.save'),
                cancelButtonText: $t('prompt.pending_offline_delay.cancel'),
                inputValue: this.pendingOfflineDelay / 1000,
                inputPattern: /\d+$/,
                inputErrorMessage: $t(
                    'prompt.pending_offline_delay.input_error'
                ),
                callback: async (action, instance) => {
                    if (
                        action === 'confirm' &&
                        instance.inputValue &&
                        !isNaN(instance.inputValue)
                    ) {
                        this.pendingOfflineDelay = Math.trunc(
                            Number(instance.inputValue) * 1000
                        );
                        await configRepository.setInt(
                            'VRCX_pendingOfflineDelay',
                            this.pendingOfflineDelay
                        );
                    }
                }
            }
        );
    };

    // #endregion
    // #region | App: ChatBox Blacklist
    $app.data.chatboxBlacklist = [
        'NP: ',
        'Now Playing',
        'Now playing',
        "▶️ '",
        '( ▶️ ',
        "' - '",
        "' by '",
        '[Spotify] '
    ];
    if (await configRepository.getString('VRCX_chatboxBlacklist')) {
        $app.data.chatboxBlacklist = JSON.parse(
            await configRepository.getString('VRCX_chatboxBlacklist')
        );
    }
    $app.data.chatboxBlacklistDialog = {
        visible: false,
        loading: false
    };

    API.$on('LOGOUT', function () {
        $app.chatboxBlacklistDialog.visible = false;
    });

    $app.methods.saveChatboxBlacklist = async function () {
        await configRepository.setString(
            'VRCX_chatboxBlacklist',
            JSON.stringify(this.chatboxBlacklist)
        );
    };

    $app.methods.showChatboxBlacklistDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.chatboxBlacklistDialog.$el)
        );
        var D = this.chatboxBlacklistDialog;
        D.visible = true;
    };

    $app.methods.checkChatboxBlacklist = function (msg) {
        for (var i = 0; i < this.chatboxBlacklist.length; ++i) {
            if (msg.includes(this.chatboxBlacklist[i])) {
                return true;
            }
        }
        return false;
    };

    // #endregion
    // #region | App: ChatBox User Blacklist
    $app.data.chatboxUserBlacklist = new Map();
    if (await configRepository.getString('VRCX_chatboxUserBlacklist')) {
        $app.data.chatboxUserBlacklist = new Map(
            Object.entries(
                JSON.parse(
                    await configRepository.getString(
                        'VRCX_chatboxUserBlacklist'
                    )
                )
            )
        );
    }

    $app.methods.saveChatboxUserBlacklist = async function () {
        await configRepository.setString(
            'VRCX_chatboxUserBlacklist',
            JSON.stringify(Object.fromEntries(this.chatboxUserBlacklist))
        );
    };

    $app.methods.addChatboxUserBlacklist = async function (user) {
        this.chatboxUserBlacklist.set(user.id, user.displayName);
        await this.saveChatboxUserBlacklist();
        this.getCurrentInstanceUserList();
    };

    $app.methods.deleteChatboxUserBlacklist = async function (userId) {
        this.chatboxUserBlacklist.delete(userId);
        await this.saveChatboxUserBlacklist();
        this.getCurrentInstanceUserList();
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.chatboxBlacklistDialog.$el)
        );
    };

    // #endregion
    // #region | App: Groups

    API.cachedGroups = new Map();
    API.currentUserGroups = new Map();
    API.queuedInstances = new Map();

    $app.methods.removeAllQueuedInstances = function () {
        API.queuedInstances.forEach((ref) => {
            ref.$msgBox?.close();
        });
        API.queuedInstances.clear();
    };

    $app.methods.removeQueuedInstance = function (instanceId) {
        var ref = API.queuedInstances.get(instanceId);
        if (typeof ref !== 'undefined') {
            ref.$msgBox.close();
            API.queuedInstances.delete(instanceId);
        }
    };

    $app.methods.instanceQueueReady = function (instanceId) {
        var ref = API.queuedInstances.get(instanceId);
        if (typeof ref !== 'undefined') {
            ref.$msgBox.close();
            API.queuedInstances.delete(instanceId);
        }
        var L = API.parseLocation(instanceId);
        var group = API.cachedGroups.get(L.groupId);
        var groupName = group?.name ?? '';
        var worldName = ref?.$worldName ?? '';
        var displayLocation = $app.displayLocation(
            instanceId,
            worldName,
            groupName
        );
        this.$message({
            message: `Instance ready to join ${displayLocation}`,
            type: 'success'
        });
        var noty = {
            created_at: new Date().toJSON(),
            type: 'group.queueReady',
            imageUrl: group?.iconUrl,
            message: `Instance ready to join ${displayLocation}`,
            location: instanceId,
            groupName,
            worldName
        };
        this.queueNotificationNoty(noty);
        this.notificationTable.data.push(noty);
        this.updateSharedFeed(true);
    };

    $app.methods.instanceQueueUpdate = async function (
        instanceId,
        position,
        queueSize
    ) {
        var ref = API.queuedInstances.get(instanceId);
        if (typeof ref === 'undefined') {
            ref = {
                $msgBox: null,
                $groupName: '',
                $worldName: '',
                location: instanceId,
                position: 0,
                queueSize: 0,
                updatedAt: 0
            };
        }
        ref.position = position;
        ref.queueSize = queueSize;
        ref.updatedAt = Date.now();
        if (!ref.$msgBox || ref.$msgBox.closed) {
            ref.$msgBox = this.$message({
                message: '',
                type: 'info',
                duration: 0,
                showClose: true,
                customClass: 'vrc-instance-queue-message'
            });
        }
        if (!ref.$groupName) {
            ref.$groupName = await this.getGroupName(instanceId);
        }
        if (!ref.$worldName) {
            ref.$worldName = await this.getWorldName(instanceId);
        }
        var displayLocation = this.displayLocation(
            instanceId,
            ref.$worldName,
            ref.$groupName
        );
        ref.$msgBox.message = `You are in position ${ref.position} of ${ref.queueSize} in the queue for ${displayLocation} `;
        API.queuedInstances.set(instanceId, ref);
        workerTimers.setTimeout(this.instanceQueueTimeout, 3600000);
    };

    $app.methods.instanceQueueTimeout = function () {
        // remove instance from queue after 1hour of inactivity
        API.queuedInstances.forEach((ref) => {
            // 59mins
            if (Date.now() - ref.updatedAt > 3540000) {
                ref.$msgBox.close();
                API.queuedInstances.delete(ref.location);
            }
        });
    };

    /*
        params: {
            groupId: string
        }
    */
    API.getGroup = function (params) {
        return this.call(`groups/${params.groupId}`, {
            method: 'GET',
            params: {
                includeRoles: params.includeRoles || false
            }
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP', args);
            return args;
        });
    };

    API.$on('GROUP', function (args) {
        args.ref = this.applyGroup(args.json);
        this.cachedGroups.set(args.ref.id, args.ref);
        if (this.currentUserGroups.has(args.ref.id)) {
            this.currentUserGroups.set(args.ref.id, args.ref);
        }
    });

    API.$on('GROUP', function (args) {
        var { ref } = args;
        var D = $app.groupDialog;
        if (D.visible === false || D.id !== ref.id) {
            return;
        }
        D.inGroup = ref.membershipStatus === 'member';
        D.ref = ref;
    });

    /*
        params: {
            userId: string
        }
    */
    API.getRepresentedGroup = function (params) {
        return this.call(`users/${params.userId}/groups/represented`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:REPRESENTED', args);
            return args;
        });
    };

    API.$on('GROUP:REPRESENTED', function (args) {
        var json = args.json;
        if (!json.groupId) {
            // no group
            return;
        }
        json.$memberId = json.id;
        json.id = json.groupId;
        this.$emit('GROUP', {
            json,
            params: {
                groupId: json.groupId,
                userId: args.params.userId
            }
        });
    });

    /*
        params: {
            userId: string
        }
    */
    API.getGroups = function (params) {
        return this.call(`users/${params.userId}/groups`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:LIST', args);
            return args;
        });
    };

    API.$on('GROUP:LIST', function (args) {
        for (var json of args.json) {
            json.$memberId = json.id;
            json.id = json.groupId;
            this.$emit('GROUP', {
                json,
                params: {
                    groupId: json.id,
                    userId: args.params.userId
                }
            });
        }
    });

    /*
        params: {
            groupId: string
        }
    */
    API.joinGroup = function (params) {
        return this.call(`groups/${params.groupId}/join`, {
            method: 'POST'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:JOIN', args);
            return args;
        });
    };

    API.$on('GROUP:JOIN', function (args) {
        var json = {
            $memberId: args.json.id,
            id: args.json.groupId,
            membershipStatus: args.json.membershipStatus,
            myMember: {
                isRepresenting: args.json.isRepresenting,
                id: args.json.id,
                roleIds: args.json.roleIds,
                joinedAt: args.json.joinedAt,
                membershipStatus: args.json.membershipStatus,
                visibility: args.json.visibility,
                isSubscribedToAnnouncements:
                    args.json.isSubscribedToAnnouncements
            }
        };
        var groupId = json.id;
        this.$emit('GROUP', {
            json,
            params: {
                groupId,
                userId: args.params.userId
            }
        });
        if ($app.groupDialog.visible && $app.groupDialog.id === groupId) {
            $app.groupDialog.inGroup = json.membershipStatus === 'member';
            $app.getGroupDialogGroup(groupId);
        }
        this.currentUserGroups.set(groupId, json);
    });

    /*
        params: {
            groupId: string
        }
    */
    API.leaveGroup = function (params) {
        return this.call(`groups/${params.groupId}/leave`, {
            method: 'POST'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:LEAVE', args);
            return args;
        });
    };

    API.$on('GROUP:LEAVE', function (args) {
        var groupId = args.params.groupId;
        if ($app.groupDialog.visible && $app.groupDialog.id === groupId) {
            $app.groupDialog.inGroup = false;
            $app.getGroupDialogGroup(groupId);
        }
        if (
            $app.userDialog.visible &&
            $app.userDialog.id === this.currentUser.id &&
            $app.userDialog.representedGroup.id === groupId
        ) {
            $app.getCurrentUserRepresentedGroup();
        }
        this.currentUserGroups.delete(groupId);
    });

    /*
        params: {
            groupId: string
        }
    */
    API.cancelGroupRequest = function (params) {
        return this.call(`groups/${params.groupId}/requests`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:CANCELJOINREQUEST', args);
            return args;
        });
    };

    API.$on('GROUP:CANCELJOINREQUEST', function (args) {
        var groupId = args.params.groupId;
        if ($app.groupDialog.visible && $app.groupDialog.id === groupId) {
            $app.groupDialog.ref.membershipStatus = 'inactive';
        }
    });

    /*
        groupId: string,
        params: {
            isRepresenting: bool
        }
    */
    API.setGroupRepresentation = function (groupId, params) {
        return this.call(`groups/${groupId}/representation`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                groupId,
                params
            };
            this.$emit('GROUP:SETREPRESENTATION', args);
            return args;
        });
    };

    API.$on('GROUP:SETREPRESENTATION', function (args) {
        if ($app.groupDialog.visible && $app.groupDialog.id === args.groupId) {
            $app.groupDialog.ref.isRepresenting = args.params.isRepresenting;
        }
        if (
            $app.userDialog.visible &&
            $app.userDialog.id === this.currentUser.id
        ) {
            $app.getCurrentUserRepresentedGroup();
        }
    });

    /*
        params: {
            query: string
        }
    */
    API.groupStrictsearch = function (params) {
        return this.call(`groups/strictsearch`, {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:STRICTSEARCH', args);
            return args;
        });
    };

    API.$on('GROUP:STRICTSEARCH', function (args) {
        for (var json of args.json) {
            this.$emit('GROUP', {
                json,
                params: {
                    groupId: json.id
                }
            });
        }
    });

    /*
        userId: string,
        groupId: string,
        params: {
            visibility: string,
            isSubscribedToAnnouncements: bool,
            managerNotes: string
        }
    */
    API.setGroupMemberProps = function (userId, groupId, params) {
        return this.call(`groups/${groupId}/members/${userId}`, {
            method: 'PUT',
            params
        }).then((json) => {
            var args = {
                json,
                userId,
                groupId,
                params
            };
            this.$emit('GROUP:MEMBER:PROPS', args);
            return args;
        });
    };

    API.$on('GROUP:MEMBER:PROPS', function (args) {
        if (args.userId !== this.currentUser.id) {
            return;
        }
        var json = args.json;
        json.$memberId = json.id;
        json.id = json.groupId;
        if ($app.groupDialog.visible && $app.groupDialog.id === json.groupId) {
            $app.groupDialog.ref.myMember.visibility = json.visibility;
            $app.groupDialog.ref.myMember.isSubscribedToAnnouncements =
                json.isSubscribedToAnnouncements;
        }
        delete json.visibility;
        if (
            $app.userDialog.visible &&
            $app.userDialog.id === this.currentUser.id
        ) {
            $app.getCurrentUserRepresentedGroup();
        }
        this.$emit('GROUP', {
            json,
            params: {
                groupId: json.groupId,
                userId: args.params.userId
            }
        });
    });

    API.$on('GROUP:MEMBER:PROPS', function (args) {
        if ($app.groupDialog.id === args.json.groupId) {
            for (var i = 0; i < $app.groupDialog.members.length; ++i) {
                var member = $app.groupDialog.members[i];
                if (member.userId === args.json.userId) {
                    Object.assign(member, this.applyGroupMember(args.json));
                    break;
                }
            }
            for (
                var i = 0;
                i < $app.groupDialog.memberSearchResults.length;
                ++i
            ) {
                var member = $app.groupDialog.memberSearchResults[i];
                if (member.userId === args.json.userId) {
                    Object.assign(member, this.applyGroupMember(args.json));
                    break;
                }
            }
        }
        if (
            $app.groupMemberModeration.visible &&
            $app.groupMemberModeration.id === args.json.groupId
        ) {
            // force redraw table
            $app.groupMembersSearch();
        }
    });

    /*
        params: {
            userId: string,
            groupId: string,
            roleId: string
        }
    */
    API.addGroupMemberRole = function (params) {
        return this.call(
            `groups/${params.groupId}/members/${params.userId}/roles/${params.roleId}`,
            {
                method: 'PUT'
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:MEMBER:ROLE:CHANGE', args);
            return args;
        });
    };

    /*
        params: {
            userId: string,
            groupId: string,
            roleId: string
        }
    */
    API.removeGroupMemberRole = function (params) {
        return this.call(
            `groups/${params.groupId}/members/${params.userId}/roles/${params.roleId}`,
            {
                method: 'DELETE'
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:MEMBER:ROLE:CHANGE', args);
            return args;
        });
    };

    API.$on('GROUP:MEMBER:ROLE:CHANGE', function (args) {
        if ($app.groupDialog.id === args.params.groupId) {
            for (var i = 0; i < $app.groupDialog.members.length; ++i) {
                var member = $app.groupDialog.members[i];
                if (member.userId === args.params.userId) {
                    member.roleIds = args.json;
                    break;
                }
            }
            for (
                var i = 0;
                i < $app.groupDialog.memberSearchResults.length;
                ++i
            ) {
                var member = $app.groupDialog.memberSearchResults[i];
                if (member.userId === args.params.userId) {
                    member.roleIds = args.json;
                    break;
                }
            }
        }

        if (
            $app.groupMemberModeration.visible &&
            $app.groupMemberModeration.id === args.params.groupId
        ) {
            // force redraw table
            $app.groupMembersSearch();
        }
    });

    /*
        params: {
            groupId: string
        }
    */
    // API.getGroupAnnouncement = function (params) {
    //     return this.call(`groups/${params.groupId}/announcement`, {
    //         method: 'GET'
    //     }).then((json) => {
    //         var args = {
    //             json,
    //             params
    //         };
    //         this.$emit('GROUP:ANNOUNCEMENT', args);
    //         return args;
    //     });
    // };

    /*
        params: {
            groupId: string,
            n: number,
            offset: number
        }
    */
    API.getGroupPosts = function (params) {
        return this.call(`groups/${params.groupId}/posts`, {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:POSTS', args);
            return args;
        });
    };

    /*
        params: {
            groupId: string
        }
    */
    API.getAllGroupPosts = async function (params) {
        var posts = [];
        var offset = 0;
        var n = 100;
        var total = 0;
        do {
            var args = await this.getGroupPosts({
                groupId: params.groupId,
                n,
                offset
            });
            posts = posts.concat(args.json.posts);
            total = args.json.total;
            offset += n;
        } while (offset < total);
        return {
            posts,
            params
        };
    };

    /*
        params: {
            groupId: string,
            userId: string
        }
    */
    API.getGroupMember = function (params) {
        return this.call(`groups/${params.groupId}/members/${params.userId}`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:MEMBER', args);
            return args;
        });
    };

    /*
        params: {
            groupId: string,
            n: number,
            offset: number
        }
    */
    API.getGroupMembers = function (params) {
        return this.call(`groups/${params.groupId}/members`, {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:MEMBERS', args);
            return args;
        });
    };

    API.$on('GROUP:MEMBERS', function (args) {
        for (var json of args.json) {
            this.$emit('GROUP:MEMBER', {
                json,
                params: {
                    groupId: args.params.groupId
                }
            });
        }
    });

    API.$on('GROUP:MEMBER', function (args) {
        args.ref = this.applyGroupMember(args.json);
    });

    /*
        params: {
            groupId: string,
            query: string,
            n: number,
            offset: number
        }
    */
    API.getGroupMembersSearch = function (params) {
        return this.call(`groups/${params.groupId}/members/search`, {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:MEMBERS:SEARCH', args);
            return args;
        });
    };

    API.$on('GROUP:MEMBERS:SEARCH', function (args) {
        for (var json of args.json.results) {
            this.$emit('GROUP:MEMBER', {
                json,
                params: {
                    groupId: args.params.groupId
                }
            });
        }
    });

    /*
        params: {
            groupId: string,
            userId: string
        }
    */
    API.sendGroupInvite = function (params) {
        return this.call(`groups/${params.groupId}/invites`, {
            method: 'POST',
            params: {
                userId: params.userId
            }
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:INVITE', args);
            return args;
        });
    };

    /*
        params: {
            groupId: string,
            userId: string
        }
    */
    API.kickGroupMember = function (params) {
        return this.call(`groups/${params.groupId}/members/${params.userId}`, {
            method: 'DELETE'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:MEMBER:KICK', args);
            return args;
        });
    };

    /*
        params: {
            groupId: string,
            userId: string
        }
    */
    API.banGroupMember = function (params) {
        return this.call(`groups/${params.groupId}/bans`, {
            method: 'POST',
            params: {
                userId: params.userId
            }
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:MEMBER:BAN', args);
            return args;
        });
    };

    /*
        params: {
            groupId: string
        }
    */

    API.getGroupInstances = function (params) {
        return this.call(
            `users/${this.currentUser.id}/instances/groups/${params.groupId}`,
            {
                method: 'GET'
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:INSTANCES', args);
            return args;
        });
    };

    API.$on('GROUP:INSTANCES', function (args) {
        for (var json of args.json.instances) {
            this.$emit('INSTANCE', {
                json,
                params: {
                    fetchedAt: args.json.fetchedAt
                }
            });
            this.getCachedWorld({
                worldId: json.world.id
            }).then((args1) => {
                json.world = args1.ref;
                return args1;
            });
            // get queue size etc
            this.getInstance({
                worldId: json.worldId,
                instanceId: json.instanceId
            });
        }
    });

    /*
        params: {
            groupId: string
        }
    */

    API.getGroupRoles = function (params) {
        return this.call(`groups/${params.groupId}/roles`, {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:ROLES', args);
            return args;
        });
    };

    API.getRequestedGroups = function () {
        return this.call(`users/${this.currentUser.id}/groups/requested`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json
            };
            this.$emit('GROUP:REQUESTED', args);
            return args;
        });
    };

    API.getUsersGroupInstances = function () {
        return this.call(`users/${this.currentUser.id}/instances/groups`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json
            };
            this.$emit('GROUP:USER:INSTANCES', args);
            return args;
        });
    };

    API.$on('GROUP:USER:INSTANCES', function (args) {
        $app.groupInstances = [];
        for (var json of args.json.instances) {
            if (args.json.fetchedAt) {
                // tack on fetchedAt
                json.$fetchedAt = args.json.fetchedAt;
            }
            this.$emit('INSTANCE', {
                json,
                params: {
                    fetchedAt: args.json.fetchedAt
                }
            });
            var ref = this.cachedGroups.get(json.ownerId);
            if (typeof ref === 'undefined') {
                if ($app.friendLogInitStatus) {
                    this.getGroup({ groupId: json.ownerId });
                }
                return;
            }
            $app.groupInstances.push({
                group: ref,
                instance: this.applyInstance(json)
            });
        }
    });

    /*
        params: {
            query: string,
            n: number,
            offset: number,
            order: string,
            sortBy: string
        }
    */
    API.groupSearch = function (params) {
        return this.call(`groups`, {
            method: 'GET',
            params
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:SEARCH', args);
            return args;
        });
    };

    API.$on('GROUP:SEARCH', function (args) {
        for (var json of args.json) {
            this.$emit('GROUP', {
                json,
                params: {
                    groupId: json.id
                }
            });
        }
    });

    /*
        params: {
            groupId: string
        }
    */
    API.getCachedGroup = function (params) {
        return new Promise((resolve, reject) => {
            var ref = this.cachedGroups.get(params.groupId);
            if (typeof ref === 'undefined') {
                this.getGroup(params).catch(reject).then(resolve);
            } else {
                resolve({
                    cache: true,
                    json: ref,
                    params,
                    ref
                });
            }
        });
    };

    API.applyGroup = function (json) {
        var ref = this.cachedGroups.get(json.id);
        if (typeof ref === 'undefined') {
            ref = {
                id: '',
                name: '',
                shortCode: '',
                description: '',
                bannerId: '',
                bannerUrl: '',
                createdAt: '',
                discriminator: '',
                galleries: [],
                iconId: '',
                iconUrl: '',
                isVerified: false,
                joinState: '',
                languages: [],
                links: [],
                memberCount: 0,
                memberCountSyncedAt: '',
                membershipStatus: '',
                onlineMemberCount: 0,
                ownerId: '',
                privacy: '',
                rules: null,
                tags: [],
                // in group
                initialRoleIds: [],
                myMember: {
                    bannedAt: null,
                    groupId: '',
                    has2FA: false,
                    id: '',
                    isRepresenting: false,
                    isSubscribedToAnnouncements: false,
                    joinedAt: '',
                    managerNotes: '',
                    membershipStatus: '',
                    permissions: [],
                    roleIds: [],
                    userId: '',
                    visibility: '',
                    _created_at: '',
                    _id: '',
                    _updated_at: ''
                },
                updatedAt: '',
                // includeRoles: true
                roles: [],
                // group list
                $memberId: '',
                groupId: '',
                isRepresenting: false,
                memberVisibility: false,
                mutualGroup: false,
                // VRCX
                $languages: [],
                ...json
            };
            this.cachedGroups.set(ref.id, ref);
        } else {
            Object.assign(ref, json);
        }
        ref.rules = $app.replaceBioSymbols(ref.rules);
        ref.name = $app.replaceBioSymbols(ref.name);
        ref.description = $app.replaceBioSymbols(ref.description);
        ref.$url = `https://vrc.group/${ref.shortCode}.${ref.discriminator}`;
        this.applyGroupLanguage(ref);
        return ref;
    };

    API.applyGroupMember = function (json) {
        if (typeof json.user !== 'undefined') {
            var ref = this.cachedUsers.get(json.user.id);
            if (typeof ref !== 'undefined') {
                json.user = ref;
            }
        } else if (json.userId === this.currentUser.id) {
            json.user = this.currentUser;
        }
        return json;
    };

    API.applyGroupLanguage = function (ref) {
        ref.$languages = [];
        var { languages } = ref;
        if (!languages) {
            return;
        }
        for (var language of languages) {
            var value = subsetOfLanguages[language];
            if (typeof value === 'undefined') {
                continue;
            }
            ref.$languages.push({
                key: language,
                value
            });
        }
    };

    $app.data.groupDialogSortingOptions = {
        joinedAtDesc: {
            name: $t('dialog.group.members.sorting.joined_at_desc'),
            value: 'joinedAt:desc'
        },
        joinedAtAsc: {
            name: $t('dialog.group.members.sorting.joined_at_asc'),
            value: 'joinedAt:asc'
        },
        userId: {
            name: $t('dialog.group.members.sorting.user_id'),
            value: ''
        }
    };

    $app.data.groupDialogFilterOptions = {
        everyone: {
            name: $t('dialog.group.members.filters.everyone'),
            id: null
        },
        usersWithNoRole: {
            name: $t('dialog.group.members.filters.users_with_no_role'),
            id: ''
        }
    };

    $app.data.groupDialog = {
        visible: false,
        loading: false,
        treeData: [],
        id: '',
        inGroup: false,
        ownerDisplayName: '',
        ref: {},
        announcement: {},
        posts: [],
        postsFiltered: [],
        members: [],
        memberSearch: '',
        memberSearchResults: [],
        instances: [],
        memberRoles: [],
        memberFilter: $app.data.groupDialogFilterOptions.everyone,
        memberSortOrder: $app.data.groupDialogSortingOptions.joinedAtDesc,
        postsSearch: '',
        galleries: {}
    };

    $app.methods.showGroupDialog = function (groupId) {
        if (!groupId) {
            return;
        }
        if (
            this.groupMemberModeration.visible &&
            this.groupMemberModeration.id !== groupId
        ) {
            this.groupMemberModeration.visible = false;
        }
        this.$nextTick(() => adjustDialogZ(this.$refs.groupDialog.$el));
        var D = this.groupDialog;
        D.visible = true;
        D.loading = true;
        D.id = groupId;
        D.inGroup = false;
        D.ownerDisplayName = '';
        D.treeData = [];
        D.announcement = {};
        D.posts = [];
        D.postsFiltered = [];
        D.instances = [];
        D.memberRoles = [];
        D.memberSearch = '';
        D.memberSearchResults = [];
        if (this.groupDialogLastGallery !== groupId) {
            D.galleries = {};
        }
        if (this.groupDialogLastMembers !== groupId) {
            D.members = [];
            D.memberFilter = this.groupDialogFilterOptions.everyone;
        }
        API.getCachedGroup({
            groupId
        })
            .catch((err) => {
                D.loading = false;
                D.visible = false;
                this.$message({
                    message: 'Failed to load group',
                    type: 'error'
                });
                throw err;
            })
            .then((args) => {
                if (groupId === args.ref.id) {
                    D.loading = false;
                    D.ref = args.ref;
                    D.inGroup = args.ref.membershipStatus === 'member';
                    D.ownerDisplayName = args.ref.ownerId;
                    API.getCachedUser({
                        userId: args.ref.ownerId
                    }).then((args1) => {
                        D.ownerDisplayName = args1.ref.displayName;
                        return args1;
                    });
                    this.applyGroupDialogInstances();
                    this.getGroupDialogGroup(groupId);
                }
            });
    };

    $app.methods.getGroupDialogGroup = function (groupId) {
        var D = this.groupDialog;
        return API.getGroup({ groupId, includeRoles: true })
            .catch((err) => {
                throw err;
            })
            .then((args1) => {
                if (D.id === args1.ref.id) {
                    D.ref = args1.ref;
                    D.inGroup = args1.ref.membershipStatus === 'member';
                    for (var role of args1.ref.roles) {
                        if (
                            D.ref &&
                            D.ref.myMember &&
                            Array.isArray(D.ref.myMember.roleIds) &&
                            D.ref.myMember.roleIds.includes(role.id)
                        ) {
                            D.memberRoles.push(role);
                        }
                    }
                    if (D.inGroup) {
                        API.getAllGroupPosts({
                            groupId
                        }).then((args2) => {
                            if (groupId === args2.params.groupId) {
                                for (var post of args2.posts) {
                                    post.title = this.replaceBioSymbols(
                                        post.title
                                    );
                                    post.text = this.replaceBioSymbols(
                                        post.text
                                    );
                                }
                                if (args2.posts.length > 0) {
                                    D.announcement = args2.posts[0];
                                }
                                D.posts = args2.posts;
                                this.updateGroupPostSearch();
                            }
                        });
                        API.getGroupInstances({
                            groupId
                        }).then((args3) => {
                            if (groupId === args3.params.groupId) {
                                this.applyGroupDialogInstances(
                                    args3.json.instances
                                );
                            }
                        });
                    }
                    if (this.$refs.groupDialogTabs.currentName === '0') {
                        this.groupDialogLastActiveTab = $t(
                            'dialog.group.info.header'
                        );
                    } else if (this.$refs.groupDialogTabs.currentName === '1') {
                        this.groupDialogLastActiveTab = $t(
                            'dialog.group.posts.header'
                        );
                    } else if (this.$refs.groupDialogTabs.currentName === '2') {
                        this.groupDialogLastActiveTab = $t(
                            'dialog.group.members.header'
                        );
                        if (this.groupDialogLastMembers !== groupId) {
                            this.groupDialogLastMembers = groupId;
                            this.getGroupDialogGroupMembers();
                        }
                    } else if (this.$refs.groupDialogTabs.currentName === '3') {
                        this.groupDialogLastActiveTab = $t(
                            'dialog.group.gallery.header'
                        );
                        if (this.groupDialogLastGallery !== groupId) {
                            this.groupDialogLastGallery = groupId;
                            this.getGroupGalleries();
                        }
                    } else if (this.$refs.groupDialogTabs.currentName === '4') {
                        this.groupDialogLastActiveTab = $t(
                            'dialog.group.json.header'
                        );
                        this.refreshGroupDialogTreeData();
                    }
                }
                return args1;
            });
    };

    $app.methods.groupDialogCommand = function (command) {
        var D = this.groupDialog;
        if (D.visible === false) {
            return;
        }
        switch (command) {
            case 'Refresh':
                this.showGroupDialog(D.id);
                break;
            case 'Moderation Tools':
                this.showGroupMemberModerationDialog(D.id);
                break;
            case 'Leave Group':
                this.leaveGroup(D.id);
                break;
            case 'Visibility Everyone':
                this.setGroupVisibility(D.id, 'visible');
                break;
            case 'Visibility Friends':
                this.setGroupVisibility(D.id, 'friends');
                break;
            case 'Visibility Hidden':
                this.setGroupVisibility(D.id, 'hidden');
                break;
            case 'Subscribe To Announcements':
                this.setGroupSubscription(D.id, true);
                break;
            case 'Unsubscribe To Announcements':
                this.setGroupSubscription(D.id, false);
                break;
            case 'Invite To Group':
                this.showInviteGroupDialog(D.id, '');
                break;
        }
    };

    $app.data.groupDialogLastActiveTab = '';
    $app.data.groupDialogLastMembers = '';
    $app.data.groupDialogLastGallery = '';

    $app.methods.groupDialogTabClick = function (obj) {
        var groupId = this.groupDialog.id;
        if (this.groupDialogLastActiveTab === obj.label) {
            return;
        }
        if (obj.label === $t('dialog.group.info.header')) {
            //
        } else if (obj.label === $t('dialog.group.posts.header')) {
            //
        } else if (obj.label === $t('dialog.group.members.header')) {
            if (this.groupDialogLastMembers !== groupId) {
                this.groupDialogLastMembers = groupId;
                this.getGroupDialogGroupMembers();
            }
        } else if (obj.label === $t('dialog.group.gallery.header')) {
            if (this.groupDialogLastGallery !== groupId) {
                this.groupDialogLastGallery = groupId;
                this.getGroupGalleries();
            }
        } else if (obj.label === $t('dialog.group.json.header')) {
            this.refreshGroupDialogTreeData();
        }
        this.groupDialogLastActiveTab = obj.label;
    };

    $app.methods.refreshGroupDialogTreeData = function () {
        var D = this.groupDialog;
        D.treeData = buildTreeData({
            group: D.ref,
            posts: D.posts,
            instances: D.instances,
            members: D.members,
            galleries: D.galleries
        });
    };

    $app.methods.joinGroup = function (groupId) {
        if (!groupId) {
            return null;
        }
        return API.joinGroup({
            groupId
        }).then((args) => {
            if (args.json.membershipStatus === 'member') {
                this.$message({
                    message: 'Group joined',
                    type: 'success'
                });
            } else if (args.json.membershipStatus === 'requested') {
                this.$message({
                    message: 'Group join request sent',
                    type: 'success'
                });
            }
            return args;
        });
    };

    API.$on('LOGOUT', function () {
        $app.groupDialog.visible = false;
    });

    $app.methods.leaveGroup = function (groupId) {
        return API.leaveGroup({
            groupId
        });
    };

    $app.methods.cancelGroupRequest = function (groupId) {
        return API.cancelGroupRequest({
            groupId
        });
    };

    $app.methods.setGroupRepresentation = function (groupId) {
        return API.setGroupRepresentation(groupId, { isRepresenting: true });
    };

    $app.methods.clearGroupRepresentation = function (groupId) {
        return API.setGroupRepresentation(groupId, { isRepresenting: false });
    };

    $app.methods.setGroupVisibility = function (groupId, visibility) {
        return API.setGroupMemberProps(API.currentUser.id, groupId, {
            visibility
        }).then((args) => {
            this.$message({
                message: 'Group visibility updated',
                type: 'success'
            });
            return args;
        });
    };

    $app.methods.setGroupSubscription = function (groupId, subscribe) {
        return API.setGroupMemberProps(API.currentUser.id, groupId, {
            isSubscribedToAnnouncements: subscribe
        }).then((args) => {
            this.$message({
                message: 'Group subscription updated',
                type: 'success'
            });
            return args;
        });
    };

    $app.methods.sendNotificationResponse = function (
        notificationId,
        responses,
        responseType
    ) {
        if (!Array.isArray(responses) || responses.length === 0) {
            return null;
        }
        var responseData = '';
        for (var i = 0; i < responses.length; i++) {
            if (responses[i].type === responseType) {
                responseData = responses[i].data;
                break;
            }
        }
        return API.sendNotificationResponse({
            notificationId,
            responseType,
            responseData
        });
    };

    $app.methods.onGroupJoined = function (groupId) {
        if (
            this.groupMemberModeration.visible &&
            this.groupMemberModeration.id === groupId
        ) {
            // ignore this event if we were the one to trigger it
            return;
        }
        if (this.groupDialog.visible && this.groupDialog.id === groupId) {
            this.showGroupDialog(groupId);
        }
        if (!API.currentUserGroups.has(groupId)) {
            API.currentUserGroups.set(groupId, {
                id: groupId,
                name: '',
                iconUrl: ''
            });
            if (this.friendLogInitStatus) {
                API.getGroup({ groupId });
            }
        }
    };

    $app.methods.onGroupLeft = function (groupId) {
        if (this.groupDialog.visible && this.groupDialog.id === groupId) {
            this.showGroupDialog(groupId);
        }
        API.currentUserGroups.delete(groupId);
    };

    // group search

    $app.methods.groupMembersSearchDebounce = function () {
        var D = this.groupDialog;
        var search = D.memberSearch;
        D.memberSearchResults = [];
        if (!search || search.length < 3) {
            this.setGroupMemberModerationTable(D.members);
            return;
        }
        this.isGroupMembersLoading = true;
        API.getGroupMembersSearch({
            groupId: D.id,
            query: search,
            n: 100,
            offset: 0
        })
            .then((args) => {
                if (D.id === args.params.groupId) {
                    D.memberSearchResults = args.json.results;
                    this.setGroupMemberModerationTable(args.json.results);
                }
            })
            .finally(() => {
                this.isGroupMembersLoading = false;
            });
    };

    $app.data.groupMembersSearchTimer = null;
    $app.data.groupMembersSearchPending = false;
    $app.methods.groupMembersSearch = function () {
        if (this.groupMembersSearchTimer) {
            this.groupMembersSearchPending = true;
        } else {
            this.groupMembersSearchExecute();
            this.groupMembersSearchTimer = setTimeout(() => {
                if (this.groupMembersSearchPending) {
                    this.groupMembersSearchExecute();
                }
                this.groupMembersSearchTimer = null;
            }, 500);
        }
    };

    $app.methods.groupMembersSearchExecute = function () {
        try {
            this.groupMembersSearchDebounce();
        } catch (err) {
            console.error(err);
        }
        this.groupMembersSearchTimer = null;
        this.groupMembersSearchPending = false;
    };

    // group posts

    $app.methods.updateGroupPostSearch = function () {
        var D = this.groupDialog;
        var search = D.postsSearch.toLowerCase();
        D.postsFiltered = D.posts.filter((post) => {
            if (search === '') {
                return true;
            }
            if (post.title.toLowerCase().includes(search)) {
                return true;
            }
            if (post.text.toLowerCase().includes(search)) {
                return true;
            }
            return false;
        });
    };

    // group members

    $app.data.isGroupMembersLoading = false;
    $app.data.isGroupMembersDone = false;
    $app.data.loadMoreGroupMembersParams = {};

    $app.methods.getGroupDialogGroupMembers = async function () {
        var D = this.groupDialog;
        D.members = [];
        this.isGroupMembersDone = false;
        this.loadMoreGroupMembersParams = {
            n: 100,
            offset: 0,
            groupId: D.id
        };
        if (D.memberSortOrder.value) {
            this.loadMoreGroupMembersParams.sort = D.memberSortOrder.value;
        }
        if (D.memberFilter.id !== null) {
            this.loadMoreGroupMembersParams.roleId = D.memberFilter.id;
        }
        if (D.inGroup) {
            await API.getGroupMember({
                groupId: D.id,
                userId: API.currentUser.id
            }).then((args) => {
                if (args.json) {
                    args.json.user = API.currentUser;
                    if (D.memberFilter.id === null) {
                        // when flitered by role don't include self
                        D.members.push(args.json);
                    }
                }
                return args;
            });
        }
        await this.loadMoreGroupMembers();
    };

    $app.methods.loadMoreGroupMembers = async function () {
        if (this.isGroupMembersDone || this.isGroupMembersLoading) {
            return;
        }
        var D = this.groupDialog;
        var params = this.loadMoreGroupMembersParams;
        D.memberSearch = '';
        this.isGroupMembersLoading = true;
        await API.getGroupMembers(params)
            .finally(() => {
                this.isGroupMembersLoading = false;
            })
            .then((args) => {
                for (var i = 0; i < args.json.length; i++) {
                    var member = args.json[i];
                    if (member.userId === API.currentUser.id) {
                        if (
                            D.members.length > 0 &&
                            D.members[0].userId === API.currentUser.id
                        ) {
                            // remove duplicate and keep sort order
                            D.members.splice(0, 1);
                        }
                        break;
                    }
                }
                if (args.json.length < params.n) {
                    this.isGroupMembersDone = true;
                }
                D.members = [...D.members, ...args.json];
                this.setGroupMemberModerationTable(D.members);
                params.offset += params.n;
                return args;
            })
            .catch((err) => {
                this.isGroupMembersDone = true;
                throw err;
            });
    };

    $app.methods.loadAllGroupMembers = async function () {
        if (this.isGroupMembersLoading) {
            return;
        }
        await this.getGroupDialogGroupMembers();
        while (this.groupDialog.visible && !this.isGroupMembersDone) {
            await this.loadMoreGroupMembers();
        }
    };

    $app.methods.setGroupMemberSortOrder = async function (sortOrder) {
        var D = this.groupDialog;
        if (D.memberSortOrder === sortOrder) {
            return;
        }
        D.memberSortOrder = sortOrder;
        await this.getGroupDialogGroupMembers();
    };

    $app.methods.setGroupMemberFilter = async function (filter) {
        var D = this.groupDialog;
        if (D.memberFilter === filter) {
            return;
        }
        D.memberFilter = filter;
        await this.getGroupDialogGroupMembers();
    };

    $app.methods.hasGroupPermission = function (ref, permission) {
        if (
            ref &&
            ref.myMember &&
            ref.myMember.permissions &&
            (ref.myMember.permissions.includes('*') ||
                ref.myMember.permissions.includes(permission))
        ) {
            return true;
        }
        return false;
    };

    $app.methods.getCurrentUserRepresentedGroup = function () {
        return API.getRepresentedGroup({
            userId: API.currentUser.id
        }).then((args) => {
            this.userDialog.representedGroup = args.json;
            return args;
        });
    };

    // group gallery

    $app.data.isGroupGalleryLoading = false;

    /*
        params: {
            groupId: string,
            galleryId: string,
            n: number,
            offset: number
        }
    */
    API.getGroupGallery = function (params) {
        return this.call(
            `groups/${params.groupId}/galleries/${params.galleryId}`,
            {
                method: 'GET',
                params: {
                    n: params.n,
                    offset: params.offset
                }
            }
        ).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('GROUP:GALLERY', args);
            return args;
        });
    };

    API.$on('GROUP:GALLERY', function (args) {
        for (var json of args.json) {
            if ($app.groupDialog.id === json.groupId) {
                if (!$app.groupDialog.galleries[json.galleryId]) {
                    $app.groupDialog.galleries[json.galleryId] = [];
                }
                $app.groupDialog.galleries[json.galleryId].push(json);
            }
        }
    });

    $app.methods.getGroupGalleries = async function () {
        this.groupDialog.galleries = {};
        this.$refs.groupDialogGallery.currentName = '0'; // select first tab
        this.isGroupGalleryLoading = true;
        for (var i = 0; i < this.groupDialog.ref.galleries.length; i++) {
            var gallery = this.groupDialog.ref.galleries[i];
            await this.getGroupGallery(this.groupDialog.id, gallery.id);
        }
        this.isGroupGalleryLoading = false;
    };

    $app.methods.getGroupGallery = async function (groupId, galleryId) {
        try {
            var params = {
                groupId,
                galleryId,
                n: 100,
                offset: 0
            };
            var count = 50; // 5000 max
            for (var i = 0; i < count; i++) {
                var args = await API.getGroupGallery(params);
                params.offset += 100;
                if (args.json.length < 100) {
                    break;
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    $app.methods.groupGalleryStatus = function (gallery) {
        var style = {};
        if (!gallery.membersOnly) {
            style.joinme = true;
        } else if (!gallery.roleIdsToView) {
            style.online = true;
        } else {
            style.busy = true;
        }
        return style;
    };

    // group invite users

    $app.data.inviteGroupDialog = {
        visible: false,
        loading: false,
        groupId: '',
        groupName: '',
        userId: '',
        userIds: [],
        userObject: {}
    };

    $app.methods.showInviteGroupDialog = function (groupId, userId) {
        this.$nextTick(() => adjustDialogZ(this.$refs.inviteGroupDialog.$el));
        var D = this.inviteGroupDialog;
        D.userIds = '';
        D.groups = [];
        D.groupId = groupId;
        D.groupName = groupId;
        D.userId = userId;
        D.userObject = {};
        D.visible = true;
        if (groupId) {
            API.getCachedGroup({
                groupId
            })
                .then((args) => {
                    D.groupName = args.ref.name;
                })
                .catch(() => {
                    D.groupId = '';
                });
            this.isAllowedToInviteToGroup();
        }

        if (userId) {
            API.getCachedUser({ userId }).then((args) => {
                D.userObject = args.ref;
            });
            D.userIds = [userId];
        }
    };

    API.$on('LOGOUT', function () {
        $app.inviteGroupDialog.visible = false;
    });

    $app.methods.sendGroupInvite = function () {
        this.$confirm('Continue? Invite User(s) To Group', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'info',
            callback: (action) => {
                var D = this.inviteGroupDialog;
                if (action !== 'confirm' || D.loading === true) {
                    return;
                }
                D.loading = true;
                var inviteLoop = () => {
                    if (D.userIds.length === 0) {
                        D.loading = false;
                        return;
                    }
                    var receiverUserId = D.userIds.shift();
                    API.sendGroupInvite({
                        groupId: D.groupId,
                        userId: receiverUserId
                    })
                        .then(inviteLoop)
                        .catch(() => {
                            D.loading = false;
                        });
                };
                inviteLoop();
            }
        });
    };

    $app.methods.isAllowedToInviteToGroup = function () {
        var D = this.inviteGroupDialog;
        var groupId = D.groupId;
        if (!groupId) {
            return;
        }
        D.loading = true;
        API.getGroup({ groupId })
            .then((args) => {
                if (this.hasGroupPermission(args.ref, 'group-invites-manage')) {
                    return args;
                }
                // not allowed to invite
                D.groupId = '';
                this.$message({
                    type: 'error',
                    message: 'You are not allowed to invite to this group'
                });
                return args;
            })
            .finally(() => {
                D.loading = false;
            });
    };

    $app.methods.openNotificationLink = function (link) {
        if (!link) {
            return;
        }
        var data = link.split(':');
        switch (data[0]) {
            case 'group':
                this.showGroupDialog(data[1]);
                break;
            case 'user':
                this.showUserDialog(data[1]);
                break;
        }
    };

    $app.methods.checkVRChatDebugLogging = async function () {
        if (this.gameLogDisabled) {
            return;
        }
        try {
            var loggingEnabled =
                await AppApi.GetVRChatRegistryKey('LOGGING_ENABLED');
            if (loggingEnabled === null) {
                // key not found
                return;
            }
            if (loggingEnabled === 1) {
                // already enabled
                return;
            }
            var result = await AppApi.SetVRChatRegistryKey(
                'LOGGING_ENABLED',
                '1',
                4
            );
            if (!result) {
                // failed to set key
                this.$alert(
                    'VRCX has noticed VRChat debug logging is disabled. VRCX requires debug logging in order to function correctly. Please enable debug logging in VRChat quick menu settings > debug > enable debug logging, then rejoin the instance or restart VRChat.',
                    'Enable debug logging'
                );
                console.error('Failed to enable debug logging', result);
                return;
            }
            this.$alert(
                'VRCX has noticed VRChat debug logging is disabled and automatically re-enabled it. VRCX requires debug logging in order to function correctly.',
                'Enabled debug logging'
            );
            console.log('Enabled debug logging');
        } catch (e) {
            console.error(e);
        }
    };

    $app.methods.downloadAndSaveImage = async function (url) {
        if (!url) {
            return;
        }
        this.$message({
            message: 'Downloading image...',
            type: 'info'
        });
        try {
            var response = await webApiService.execute({
                url,
                method: 'GET'
            });
            if (
                response.status !== 200 ||
                !response.data.startsWith('data:image/png')
            ) {
                throw new Error(`Error: ${response.data}`);
            }
            var link = document.createElement('a');
            link.href = response.data;
            var fileName = `${extractFileId(url)}.png`;
            if (!fileName) {
                fileName = `${url.split('/').pop()}.png`;
            }
            if (!fileName) {
                fileName = 'image.png';
            }
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            new Noty({
                type: 'error',
                text: escapeTag(`Failed to download image. ${url}`)
            }).show();
        }
    };

    $app.methods.downloadAndSaveJson = function (fileName, data) {
        if (!fileName || !data) {
            return;
        }
        try {
            var link = document.createElement('a');
            link.setAttribute(
                'href',
                `data:application/json;charset=utf-8,${encodeURIComponent(
                    JSON.stringify(data, null, 2)
                )}`
            );
            link.setAttribute('download', `${fileName}.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            new Noty({
                type: 'error',
                text: escapeTag('Failed to download JSON.')
            }).show();
        }
    };

    $app.methods.setPlayerModeration = function (userId, type) {
        var D = this.userDialog;
        AppApi.SetVRChatUserModeration(API.currentUser.id, userId, type).then(
            (result) => {
                if (result) {
                    if (type === 4) {
                        D.isShowAvatar = false;
                        D.isHideAvatar = true;
                    } else if (type === 5) {
                        D.isShowAvatar = true;
                        D.isHideAvatar = false;
                    } else {
                        D.isShowAvatar = false;
                        D.isHideAvatar = false;
                    }
                } else {
                    $app.$message({
                        message: 'Failed to change avatar moderation',
                        type: 'error'
                    });
                }
            }
        );
    };

    // #endregion
    // #region | App: Language

    $app.data.appLanguage = 'en';
    var initLanguage = async () => {
        if (await configRepository.getString('VRCX_appLanguage')) {
            $app.data.appLanguage =
                await configRepository.getString('VRCX_appLanguage');
            i18n.locale = $app.data.appLanguage;
        } else {
            var result = await AppApi.CurrentLanguage();
            if (!result) {
                console.error('Failed to get current language');
                await $app.changeAppLanguage('en');
                return;
            }
            var lang = result.split('-')[0];
            i18n.availableLocales.forEach(async (ref) => {
                var refLang = ref.split('_')[0];
                if (refLang === lang) {
                    await $app.changeAppLanguage(ref);
                }
            });
        }
    };
    await initLanguage();

    $app.methods.changeAppLanguage = async function (language) {
        console.log('Language changed:', language);
        this.appLanguage = language;
        i18n.locale = language;
        await configRepository.setString('VRCX_appLanguage', language);
        this.updateVRConfigVars();
    };

    // #endregion
    // #region | App: Random unsorted app methods, data structs, API functions, and an API feedback/file analysis event
    API.$on('USER:FEEDBACK', function (args) {
        if (args.params.userId === this.currentUser.id) {
            $app.currentUserFeedbackData = buildTreeData(args.json);
        }
    });

    $app.methods.getCurrentUserFeedback = function () {
        return API.getUserFeedback({ userId: API.currentUser.id });
    };

    $app.methods.gameLogIsFriend = function (row) {
        if (typeof row.isFriend !== 'undefined') {
            return row.isFriend;
        }
        if (!row.userId) {
            return false;
        }
        row.isFriend = this.friends.has(row.userId);
        return row.isFriend;
    };

    $app.methods.gameLogIsFavorite = function (row) {
        if (typeof row.isFavorite !== 'undefined') {
            return row.isFavorite;
        }
        if (!row.userId || API.cachedFavoritesByObjectId.size === 0) {
            return false;
        }
        row.isFavorite = API.cachedFavoritesByObjectId.has(row.userId);
        return row.isFavorite;
    };

    $app.data.changeLogDialog = {
        visible: false,
        buildName: '',
        changeLog: ''
    };

    $app.methods.showChangeLogDialog = function () {
        this.$nextTick(() => adjustDialogZ(this.$refs.changeLogDialog.$el));
        this.changeLogDialog.visible = true;
        this.checkForVRCXUpdate();
    };

    $app.data.gallerySelectDialog = {
        visible: false,
        destenationFeild: ''
    };

    $app.methods.showGallerySelectDialog = function (destenationFeild) {
        this.$nextTick(() => adjustDialogZ(this.$refs.gallerySelectDialog.$el));
        var D = this.gallerySelectDialog;
        D.destenationFeild = destenationFeild;
        D.visible = true;
        this.refreshGalleryTable();
    };

    $app.methods.selectImageGallerySelect = function (imageUrl, fileId) {
        var D = this.gallerySelectDialog;
        D.visible = false;
        console.log(imageUrl, fileId);
    };

    $app.methods.reportUserForHacking = function (userId) {
        API.reportUser({
            userId,
            contentType: 'user',
            reason: 'behavior-hacking',
            type: 'report'
        });
    };

    /*
        params: {
            userId: string,
            contentType: string,
            reason: string,
            type: string
        }
    */
    API.reportUser = function (params) {
        return this.call(`feedback/${params.userId}/user`, {
            method: 'POST',
            params: {
                contentType: params.contentType,
                reason: params.reason,
                type: params.type
            }
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FEEDBACK:REPORT:USER', args);
            return args;
        });
    };

    $app.methods.changeLogRemoveLinks = function (text) {
        return text.replace(/([^!])\[[^\]]+\]\([^)]+\)/g, '$1');
    };

    /*
        params: {
            fileId: string,
            version: number
        }
    */
    API.getFileAnalysis = function (params) {
        return this.call(`analysis/${params.fileId}/${params.version}`, {
            method: 'GET'
        }).then((json) => {
            var args = {
                json,
                params
            };
            this.$emit('FILE:ANALYSIS', args);
            return args;
        });
    };

    API.$on('FILE:ANALYSIS', function (args) {
        if (!$app.avatarDialog.visible) {
            return;
        }
        var ref = args.json;
        if (typeof ref.fileSize !== 'undefined') {
            ref._fileSize = `${(ref.fileSize / 1048576).toFixed(2)} MB`;
        }
        if (typeof ref.uncompressedSize !== 'undefined') {
            ref._uncompressedSize = `${(ref.uncompressedSize / 1048576).toFixed(
                2
            )} MB`;
        }
        if (typeof ref.avatarStats?.totalTextureUsage !== 'undefined') {
            ref._totalTextureUsage = `${(
                ref.avatarStats.totalTextureUsage / 1048576
            ).toFixed(2)} MB`;
        }
        $app.avatarDialog.fileAnalysis = buildTreeData(args.json);
    });

    $app.methods.getAvatarFileAnalysis = function () {
        var D = this.avatarDialog;
        var assetUrl = '';
        for (let i = D.ref.unityPackages.length - 1; i > -1; i--) {
            var unityPackage = D.ref.unityPackages[i];
            if (unityPackage.variant && unityPackage.variant !== 'standard') {
                continue;
            }
            if (
                unityPackage.platform === 'standalonewindows' &&
                this.compareUnityVersion(unityPackage.unityVersion)
            ) {
                assetUrl = unityPackage.assetUrl;
                break;
            }
        }
        if (!assetUrl) {
            assetUrl = D.ref.assetUrl;
        }
        var fileId = extractFileId(assetUrl);
        var version = parseInt(extractFileVersion(assetUrl), 10);
        if (!fileId || !version) {
            this.$message({
                message: 'File Analysis unavailable',
                type: 'error'
            });
            return;
        }
        API.getFileAnalysis({ fileId, version });
    };

    $app.methods.openFolderGeneric = function (path) {
        AppApi.OpenFolderAndSelectItem(path, true);
    };

    // #endregion
    // #region | Dialog: fullscreen image

    $app.data.fullscreenImageDialog = {
        visible: false,
        imageUrl: ''
    };

    $app.methods.showFullscreenImageDialog = function (imageUrl) {
        if (!imageUrl) {
            return;
        }
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.fullscreenImageDialog.$el)
        );
        var D = this.fullscreenImageDialog;
        D.imageUrl = imageUrl;
        D.visible = true;
    };

    // #endregion
    // #region | Open common folders

    $app.methods.openVrcxAppDataFolder = function () {
        AppApi.OpenVrcxAppDataFolder().then((result) => {
            if (result) {
                this.$message({
                    message: 'Folder opened',
                    type: 'success'
                });
            } else {
                this.$message({
                    message: "Folder dosn't exist",
                    type: 'error'
                });
            }
        });
    };

    $app.methods.openVrcAppDataFolder = function () {
        AppApi.OpenVrcAppDataFolder().then((result) => {
            if (result) {
                this.$message({
                    message: 'Folder opened',
                    type: 'success'
                });
            } else {
                this.$message({
                    message: "Folder dosn't exist",
                    type: 'error'
                });
            }
        });
    };

    $app.methods.openVrcPhotosFolder = function () {
        AppApi.OpenVrcPhotosFolder().then((result) => {
            if (result) {
                this.$message({
                    message: 'Folder opened',
                    type: 'success'
                });
            } else {
                this.$message({
                    message: "Folder dosn't exist",
                    type: 'error'
                });
            }
        });
    };

    $app.methods.openVrcScreenshotsFolder = function () {
        AppApi.OpenVrcScreenshotsFolder().then((result) => {
            if (result) {
                this.$message({
                    message: 'Folder opened',
                    type: 'success'
                });
            } else {
                this.$message({
                    message: "Folder dosn't exist",
                    type: 'error'
                });
            }
        });
    };

    $app.methods.openCrashVrcCrashDumps = function () {
        AppApi.OpenCrashVrcCrashDumps().then((result) => {
            if (result) {
                this.$message({
                    message: 'Folder opened',
                    type: 'success'
                });
            } else {
                this.$message({
                    message: "Folder dosn't exist",
                    type: 'error'
                });
            }
        });
    };

    // #endregion
    // #region | Dialog: registry backup dialog

    $app.data.registryBackupDialog = {
        visible: false
    };

    $app.data.registryBackupTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini',
            defaultSort: {
                prop: 'date',
                order: 'descending'
            }
        },
        layout: 'table'
    };

    $app.methods.showRegistryBackupDialog = function () {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.registryBackupDialog.$el)
        );
        var D = this.registryBackupDialog;
        D.visible = true;
        this.updateRegistryBackupDialog();
    };

    $app.methods.updateRegistryBackupDialog = async function () {
        var D = this.registryBackupDialog;
        this.registryBackupTable.data = [];
        if (!D.visible) {
            return;
        }
        var backupsJson = await configRepository.getString(
            'VRCX_VRChatRegistryBackups'
        );
        if (!backupsJson) {
            backupsJson = JSON.stringify([]);
        }
        this.registryBackupTable.data = JSON.parse(backupsJson);
    };

    $app.methods.promptVrcRegistryBackupName = async function () {
        var name = await this.$prompt(
            'Enter a name for the backup',
            'Backup Name',
            {
                confirmButtonText: 'Confirm',
                cancelButtonText: 'Cancel',
                inputPattern: /\S+/,
                inputErrorMessage: 'Name is required',
                inputValue: 'Backup'
            }
        );
        if (name.action === 'confirm') {
            this.backupVrcRegistry(name.value);
        }
    };

    $app.methods.backupVrcRegistry = async function (name) {
        var regJson = await AppApi.GetVRChatRegistry();
        var newBackup = {
            name,
            date: new Date().toJSON(),
            data: regJson
        };
        var backupsJson = await configRepository.getString(
            'VRCX_VRChatRegistryBackups'
        );
        if (!backupsJson) {
            backupsJson = JSON.stringify([]);
        }
        var backups = JSON.parse(backupsJson);
        backups.push(newBackup);
        await configRepository.setString(
            'VRCX_VRChatRegistryBackups',
            JSON.stringify(backups)
        );
        await this.updateRegistryBackupDialog();
    };

    $app.methods.deleteVrcRegistryBackup = async function (row) {
        var backups = this.registryBackupTable.data;
        removeFromArray(backups, row);
        await configRepository.setString(
            'VRCX_VRChatRegistryBackups',
            JSON.stringify(backups)
        );
        await this.updateRegistryBackupDialog();
    };

    $app.methods.restoreVrcRegistryBackup = function (row) {
        this.$confirm('Continue? Restore Backup', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'warning',
            callback: (action) => {
                if (action !== 'confirm') {
                    return;
                }
                var data = JSON.stringify(row.data);
                AppApi.SetVRChatRegistry(data)
                    .then(() => {
                        this.$message({
                            message: 'VRC registry settings restored',
                            type: 'success'
                        });
                    })
                    .catch((e) => {
                        console.error(e);
                        this.$message({
                            message: `Failed to restore VRC registry settings, check console for full error: ${e}`,
                            type: 'error'
                        });
                    });
            }
        });
    };

    $app.methods.saveVrcRegistryBackupToFile = function (row) {
        this.downloadAndSaveJson(row.name, row.data);
    };

    $app.methods.restoreVrcRegistryFromFile = function (json) {
        try {
            var data = JSON.parse(json);
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid JSON');
            }
            // quick check to make sure it's a valid registry backup
            for (var key in data) {
                var value = data[key];
                if (
                    typeof value !== 'object' ||
                    typeof value.type !== 'number' ||
                    typeof value.data === 'undefined'
                ) {
                    throw new Error('Invalid JSON');
                }
            }
            AppApi.SetVRChatRegistry(json)
                .then(() => {
                    this.$message({
                        message: 'VRC registry settings restored',
                        type: 'success'
                    });
                })
                .catch((e) => {
                    console.error(e);
                    this.$message({
                        message: `Failed to restore VRC registry settings, check console for full error: ${e}`,
                        type: 'error'
                    });
                });
        } catch {
            this.$message({
                message: 'Invalid JSON',
                type: 'error'
            });
        }
    };

    $app.methods.deleteVrcRegistry = function () {
        this.$confirm('Continue? Delete VRC Registry Settings', 'Confirm', {
            confirmButtonText: 'Confirm',
            cancelButtonText: 'Cancel',
            type: 'warning',
            callback: (action) => {
                if (action !== 'confirm') {
                    return;
                }
                AppApi.DeleteVRChatRegistryFolder().then(() => {
                    this.$message({
                        message: 'VRC registry settings deleted',
                        type: 'success'
                    });
                });
            }
        });
    };

    $app.methods.clearVrcRegistryDialog = function () {
        this.registryBackupTable.data = [];
    };

    $app.methods.checkAutoBackupRestoreVrcRegistry = async function () {
        if (!this.vrcRegistryAutoBackup) {
            return;
        }

        // check for auto restore
        var hasVRChatRegistryFolder = await AppApi.HasVRChatRegistryFolder();
        if (!hasVRChatRegistryFolder) {
            var lastBackupDate = await configRepository.getString(
                'VRCX_VRChatRegistryLastBackupDate'
            );
            var lastRestoreCheck = await configRepository.getString(
                'VRCX_VRChatRegistryLastRestoreCheck'
            );
            if (
                !lastBackupDate ||
                (lastRestoreCheck &&
                    lastBackupDate &&
                    lastRestoreCheck === lastBackupDate)
            ) {
                // only ask to restore once and when backup is present
                return;
            }
            // popup message about auto restore
            this.$alert(
                $t('dialog.registry_backup.restore_prompt'),
                $t('dialog.registry_backup.header')
            );
            this.showRegistryBackupDialog();
            await AppApi.FocusWindow();
            await configRepository.setString(
                'VRCX_VRChatRegistryLastRestoreCheck',
                lastBackupDate
            );
        } else {
            await this.autoBackupVrcRegistry();
        }
    };

    $app.methods.autoBackupVrcRegistry = async function () {
        var date = new Date();
        var lastBackupDate = await configRepository.getString(
            'VRCX_VRChatRegistryLastBackupDate'
        );
        if (lastBackupDate) {
            var lastBackup = new Date(lastBackupDate);
            var diff = date.getTime() - lastBackup.getTime();
            var diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
            if (diffDays < 7) {
                return;
            }
        }
        var backupsJson = await configRepository.getString(
            'VRCX_VRChatRegistryBackups'
        );
        if (!backupsJson) {
            backupsJson = JSON.stringify([]);
        }
        var backups = JSON.parse(backupsJson);
        backups.forEach((backup) => {
            if (backup.name === 'Auto Backup') {
                // remove old auto backup
                removeFromArray(backups, backup);
            }
        });
        await configRepository.setString(
            'VRCX_VRChatRegistryBackups',
            JSON.stringify(backups)
        );
        this.backupVrcRegistry('Auto Backup');
        await configRepository.setString(
            'VRCX_VRChatRegistryLastBackupDate',
            date.toJSON()
        );
    };

    // #endregion
    // #region | Dialog: group member moderation

    $app.data.groupMemberModeration = {
        visible: false,
        loading: false,
        id: '',
        groupRef: {},
        note: '',
        selectedUsers: new Map(),
        selectedUsersArray: [],
        selectedRoles: [],
        progressCurrent: 0,
        progressTotal: 0
    };

    $app.data.groupMemberModerationTable = {
        data: [],
        tableProps: {
            stripe: true,
            size: 'mini'
        },
        pageSize: $app.data.tablePageSize,
        paginationProps: {
            small: true,
            layout: 'sizes,prev,pager,next,total',
            pageSizes: [10, 15, 25, 50, 100]
        }
    };

    $app.data.groupMemberModerationTableForceUpdate = 0;

    $app.methods.setGroupMemberModerationTable = function (data) {
        if (!this.groupMemberModeration.visible) {
            return;
        }
        for (var i = 0; i < data.length; i++) {
            var member = data[i];
            member.$selected = this.groupMemberModeration.selectedUsers.has(
                member.userId
            );
        }
        this.groupMemberModerationTable.data = data;
        // force redraw
        this.groupMemberModerationTableForceUpdate++;
    };

    $app.methods.showGroupMemberModerationDialog = function (groupId) {
        this.$nextTick(() =>
            adjustDialogZ(this.$refs.groupMemberModeration.$el)
        );
        if (groupId !== this.groupDialog.id) {
            return;
        }
        var D = this.groupMemberModeration;
        D.id = groupId;
        D.selectedUsers.clear();
        D.selectedUsersArray = [];
        D.selectedRoles = [];
        D.groupRef = {};
        API.getCachedGroup({ groupId }).then((args) => {
            D.groupRef = args.ref;
        });
        this.groupMemberModerationTableForceUpdate = 0;
        D.visible = true;
        this.setGroupMemberModerationTable(this.groupDialog.members);
    };

    $app.methods.groupMemberModerationTableSelectionChange = function (row) {
        var D = this.groupMemberModeration;
        if (row.$selected && !D.selectedUsers.has(row.userId)) {
            D.selectedUsers.set(row.userId, row);
        } else if (!row.$selected && D.selectedUsers.has(row.userId)) {
            D.selectedUsers.delete(row.userId);
        }
        D.selectedUsersArray = Array.from(D.selectedUsers.values());
        // force redraw
        this.groupMemberModerationTableForceUpdate++;
    };

    $app.methods.deleteSelectedGroupMember = function (user) {
        var D = this.groupMemberModeration;
        D.selectedUsers.delete(user.userId);
        D.selectedUsersArray = Array.from(D.selectedUsers.values());
        for (var i = 0; i < this.groupMemberModerationTable.data.length; i++) {
            var row = this.groupMemberModerationTable.data[i];
            if (row.userId === user.userId) {
                row.$selected = false;
                break;
            }
        }
        // force redraw
        this.groupMemberModerationTableForceUpdate++;
    };

    $app.methods.clearSelectedGroupMembers = function () {
        var D = this.groupMemberModeration;
        D.selectedUsers.clear();
        D.selectedUsersArray = [];
        for (var i = 0; i < this.groupMemberModerationTable.data.length; i++) {
            var row = this.groupMemberModerationTable.data[i];
            row.$selected = false;
        }
        // force redraw
        this.groupMemberModerationTableForceUpdate++;
    };

    $app.methods.selectAllGroupMembers = function () {
        var D = this.groupMemberModeration;
        for (var i = 0; i < this.groupMemberModerationTable.data.length; i++) {
            var row = this.groupMemberModerationTable.data[i];
            row.$selected = true;
            D.selectedUsers.set(row.userId, row);
        }
        D.selectedUsersArray = Array.from(D.selectedUsers.values());
        // force redraw
        this.groupMemberModerationTableForceUpdate++;
    };

    $app.methods.groupMembersKick = async function () {
        var D = this.groupMemberModeration;
        var memberCount = D.selectedUsersArray.length;
        D.progressTotal = memberCount;
        try {
            for (var i = 0; i < memberCount; i++) {
                if (!D.visible || !D.progressTotal) {
                    break;
                }
                var user = D.selectedUsersArray[i];
                D.progressCurrent = i + 1;
                if (user.userId === API.currentUser.id) {
                    continue;
                }
                await API.kickGroupMember({
                    groupId: D.id,
                    userId: user.userId
                });
                console.log(`Kicking ${user.userId} ${i + 1}/${memberCount}`);
            }
        } catch (err) {
            console.error(err);
            this.$message({
                message: `Failed to kick group member: ${err}`,
                type: 'error'
            });
        } finally {
            D.progressCurrent = 0;
            D.progressTotal = 0;
        }
    };

    $app.methods.groupMembersBan = async function () {
        var D = this.groupMemberModeration;
        var memberCount = D.selectedUsersArray.length;
        D.progressTotal = memberCount;
        try {
            for (var i = 0; i < memberCount; i++) {
                if (!D.visible || !D.progressTotal) {
                    break;
                }
                var user = D.selectedUsersArray[i];
                D.progressCurrent = i + 1;
                if (user.userId === API.currentUser.id) {
                    continue;
                }
                await API.banGroupMember({
                    groupId: D.id,
                    userId: user.userId
                });
                console.log(`Banning ${user.userId} ${i + 1}/${memberCount}`);
            }
        } catch (err) {
            console.error(err);
            this.$message({
                message: `Failed to ban group member: ${err}`,
                type: 'error'
            });
        } finally {
            D.progressCurrent = 0;
            D.progressTotal = 0;
        }
    };

    $app.methods.groupMembersSaveNote = async function () {
        var D = this.groupMemberModeration;
        var memberCount = D.selectedUsersArray.length;
        D.progressTotal = memberCount;
        try {
            for (var i = 0; i < memberCount; i++) {
                if (!D.visible || !D.progressTotal) {
                    break;
                }
                var user = D.selectedUsersArray[i];
                D.progressCurrent = i + 1;
                if (user.managerNotes === D.note) {
                    continue;
                }
                await API.setGroupMemberProps(user.userId, D.id, {
                    managerNotes: D.note
                });
                console.log(
                    `Setting note ${D.note} ${user.userId} ${
                        i + 1
                    }/${memberCount}`
                );
            }
            this.$message({
                message: 'Note saved',
                type: 'success'
            });
        } catch (err) {
            console.error(err);
            this.$message({
                message: `Failed to set group member note: ${err}`,
                type: 'error'
            });
        } finally {
            D.progressCurrent = 0;
            D.progressTotal = 0;
        }
    };

    $app.methods.groupMembersAddRoles = async function () {
        var D = this.groupMemberModeration;
        var memberCount = D.selectedUsersArray.length;
        D.progressTotal = memberCount;
        try {
            for (var i = 0; i < memberCount; i++) {
                if (!D.visible || !D.progressTotal) {
                    break;
                }
                var user = D.selectedUsersArray[i];
                D.progressCurrent = i + 1;
                var rolesToAdd = [];
                D.selectedRoles.forEach((roleId) => {
                    if (!user.roleIds.includes(roleId)) {
                        rolesToAdd.push(roleId);
                    }
                });

                if (!rolesToAdd.length) {
                    continue;
                }
                for (var j = 0; j < rolesToAdd.length; j++) {
                    var roleId = rolesToAdd[j];
                    console.log(
                        `Adding role: ${roleId} ${user.userId} ${
                            i + 1
                        }/${memberCount}`
                    );
                    await API.addGroupMemberRole({
                        groupId: D.id,
                        userId: user.userId,
                        roleId
                    });
                }
            }
            this.$message({
                message: 'Added group member roles',
                type: 'success'
            });
        } catch (err) {
            console.error(err);
            this.$message({
                message: `Failed to add group member roles: ${err}`,
                type: 'error'
            });
        } finally {
            D.progressCurrent = 0;
            D.progressTotal = 0;
        }
    };

    $app.methods.groupMembersRemoveRoles = async function () {
        var D = this.groupMemberModeration;
        var memberCount = D.selectedUsersArray.length;
        D.progressTotal = memberCount;
        try {
            for (var i = 0; i < memberCount; i++) {
                if (!D.visible || !D.progressTotal) {
                    break;
                }
                var user = D.selectedUsersArray[i];
                D.progressCurrent = i + 1;
                var rolesToRemove = [];
                D.selectedRoles.forEach((roleId) => {
                    if (user.roleIds.includes(roleId)) {
                        rolesToRemove.push(roleId);
                    }
                });
                if (!rolesToRemove.length) {
                    continue;
                }
                for (var j = 0; j < rolesToRemove.length; j++) {
                    var roleId = rolesToRemove[j];
                    console.log(
                        `Removing role ${roleId} ${user.userId} ${
                            i + 1
                        }/${memberCount}`
                    );
                    await API.removeGroupMemberRole({
                        groupId: D.id,
                        userId: user.userId,
                        roleId
                    });
                }
            }
            this.$message({
                message: 'Roles removed',
                type: 'success'
            });
        } catch (err) {
            console.error(err);
            this.$message({
                message: `Failed to remove group member roles: ${err}`,
                type: 'error'
            });
        } finally {
            D.progressCurrent = 0;
            D.progressTotal = 0;
        }
    };

    // #endregion

    $app = new Vue($app);
    window.$app = $app;
})();
// #endregion

// // #endregion
// // #region | Dialog: templateDialog

// $app.data.templateDialog = {
//     visible: false,
// };

// $app.methods.showTemplateDialog = function () {
//     this.$nextTick(() => adjustDialogZ(this.$refs.templateDialog.$el));
//     var D = this.templateDialog;
//     D.visible = true;
// };

// // #endregion
