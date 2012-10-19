/**
 * UTIL LOCALS
 */
var NOW    = 1
,   URLBIT = '/'
,   XHRTME = 310000;

/**
 * NEXTORIGIN
 * ==========
 * var next_origin = nextorigin();
 */
var nextorigin = (function() {
    var ori = Math.floor(Math.random() * 9) + 1;
    return function(origin) {
        return origin.indexOf('pubsub') > 0
            && origin.replace(
             'pubsub', 'ps' + (++ori < 10 ? ori : ori=1)
            ) || origin;
    }
})();

/**
 * EACH
 * ====
 * each( [1,2,3], function(item) { console.log(item) } )
 */
function each( o, f ) {
    if ( !o || !f ) return;

    if ( typeof o[0] != 'undefined' )
        for ( var i = 0, l = o.length; i < l; )
            f.call( o[i], o[i], i++ );
    else
        for ( var i in o )
            o.hasOwnProperty    &&
            o.hasOwnProperty(i) &&
            f.call( o[i], i, o[i] );
}

/**
 * MAP
 * ===
 * var list = map( [1,2,3], function(item) { return item + 1 } )
 */
function map( list, fun ) {
    var fin = [];
    each( list || [], function( k, v ) { fin.push(fun( k, v )) } );
    return fin;
}

/**
 * GREP
 * ====
 * var list = grep( [1,2,3], function(item) { return item % 2 } )
 */
function grep( list, fun ) {
    var fin = [];
    each( list || [], function(l) { fun(l) && fin.push(l) } );
    return fin
}

/**
 * timeout
 * =======
 * timeout( function(){}, 100 );
 */
function timeout( fun, wait ) {
    return setTimeout( fun, wait );
}

/**
 * ENCODE
 * ======
 * var encoded_path = encode('path');
 */
function encode(path) {
    return map( (encodeURIComponent(path)).split(''), function(chr) {
        return "-_.!~*'()".indexOf(chr) < 0 ? chr :
               "%"+chr.charCodeAt(0).toString(16).toUpperCase()
    } ).join('');
}


/**
 * CORS XHR Request
 * ================
 *  xdr({
 *     url     : ['http://www.blah.com/url'],
 *     success : function(response) {},
 *     fail    : function() {}
 *  });
 */
function xdr( setup ) {
    var xhr
    ,   finished = function() {
            if (loaded) return;
                loaded = 1;

            clearTimeout(timer);

            try       { response = JSON['parse'](xhr.responseText); }
            catch (r) { return done(1); }

            success(response);
        }
    ,   complete = 0
    ,   loaded   = 0
    ,   timer    = timeout( function(){done(1)}, XHRTME )
    ,   fail     = setup.fail    || function(){}
    ,   success  = setup.success || function(){}
    ,   done     = function(failed) {
            if (complete) return;
                complete = 1;

            clearTimeout(timer);

            if (xhr) {
                xhr.onerror = xhr.onload = null;
                xhr.abort && xhr.abort();
                xhr = null;
            }

            failed && fail();
        };

    // Send
    try {
        xhr = typeof XDomainRequest !== 'undefined' && 
              new XDomainRequest()  ||
              new XMLHttpRequest();

        xhr.onerror = xhr.onabort   = function(){ done(1) };
        xhr.onload  = xhr.onloadend = finished;
        xhr.timeout = XHRTME;

        xhr.open( 'GET', setup.url.join(URLBIT), true );
        xhr.send();
    }
    catch(eee) {
        done(0);
        return xdr(setup);
    }

    // Return 'done'
    return done;
}


function PN_API(setup) {
	var CHANNELS      = {}
    ,   PUBLISH_KEY   = setup['publish_key']   || ''
    ,   SUBSCRIBE_KEY = setup['subscribe_key'] || ''
    ,   SSL           = setup['ssl'] ? 's' : ''
    ,   ORIGIN        = 'http'+SSL+'://'+(setup['origin']||'pubsub.pubnub.com')

    SELF = {
		/*
		PUBNUB.history({
		channel  : 'my_chat_channel',
		limit    : 100,
		callback : function(messages) { console.log(messages) }
		});
		*/
		'history' : function( args, callback ) {
			var callback = args['callback'] || callback 
			,   limit    = args['limit'] || 100
			,   channel  = args['channel'];

			// Make sure we have a Channel
			if (!channel)  return log('Missing Channel');
			if (!callback) return log('Missing Callback');

			// Send Message
			xdr({
				url      : [
				ORIGIN, 'history',
				SUBSCRIBE_KEY, encode(channel),
				0, limit
				],
				success  : function(response) { callback(response) },
				fail     : function(response) { callback(response) }
			});
		},

		/*
		 PUBNUB.time(function(time){ console.log(time) });
		 */
		'time' : function(callback) {
		 	xdr({
		 		url      : [ORIGIN, 'time', 0],
		 		success  : function(response) { callback(response[0]) },
		 		fail     : function() { callback(0) }
		 	});
		},

		/*
		 PUBNUB.uuid(function(uuid) { console.log(uuid) });
		 */
		'uuid' : function(callback) {
		 	xdr({
		 		url      : [
		 		'http' + SSL + '://pubnub-prod.appspot.com/uuid'
		 		],
		 		success  : function(response) { callback(response[0]) },
		 		fail     : function() { callback(0) }
		 	});
		},

		/*
		PUBNUB.publish({
		channel : 'my_chat_channel',
		message : 'hello!'
		});
		*/
		'publish' : function( args, callback ) {
			var callback = callback || args['callback'] || function(){}
			,   message  = args['message']
			,   channel  = args['channel']
			,   url;

			if (!message)     return log('Missing Message');
			if (!channel)     return log('Missing Channel');
			if (!PUBLISH_KEY) return log('Missing Publish Key');

			// If trying to send Object
			message = JSON['stringify'](message);

			// Create URL
			url = [
			ORIGIN, 'publish',
			PUBLISH_KEY, SUBSCRIBE_KEY,
			0, encode(channel),
			0, encode(message)
			];

			// Send Message
			xdr({
				success  : function(response) { callback(response) },
				fail     : function() { callback([ 0, 'Disconnected' ]) },
				url      : url
			});
		},

		/*
		PUBNUB.unsubscribe({ channel : 'my_chat' });
		*/
		'unsubscribe' : function(args) {
			var channel = args['channel'];

			// Leave if there never was a channel.
			if (!(channel in CHANNELS)) return;

			// Disable Channel
			CHANNELS[channel].connected = 0;

			// Abort and Remove Script
			CHANNELS[channel].done && 
			CHANNELS[channel].done(0);
		},

		/*
		 PUBNUB.subscribe({
		channel  : 'my_chat'
		callback : function(message) { console.log(message) }
		});
		*/
		'subscribe' : function( args, callback ) {

			var channel      = args['channel']
			,   callback     = callback || args['callback']
			,   restore      = args['restore']
			,   timetoken    = 0
			,   error        = args['error'] || function(){}
			,   connect      = args['connect'] || function(){}
			,   reconnect    = args['reconnect'] || function(){}
			,   disconnect   = args['disconnect'] || function(){}
			,   disconnected = 0
			,   connected    = 0
			,   origin       = nextorigin(ORIGIN);

			// Make sure we have a Channel
			if (!channel)       return log('Missing Channel');
			if (!callback)      return log('Missing Callback');
			if (!SUBSCRIBE_KEY) return log('Missing Subscribe Key');

			if (!(channel in CHANNELS)) CHANNELS[channel] = {};

			// Make sure we have a Channel
			if (CHANNELS[channel].connected) return log('Already Connected');
				CHANNELS[channel].connected = 1;

											// Recurse Subscribe
			function pubnub() {
				// Stop Connection
				if (!CHANNELS[channel].connected) return;

				// Connect to PubNub Subscribe Servers
				CHANNELS[channel].done = xdr({
					callback : 0,
					url      : [
					origin, 'subscribe',
					SUBSCRIBE_KEY, encode(channel),
					0, timetoken
					],
					fail : function() {
						// Disconnect
						if (!disconnected) {
							disconnected = 1;
							disconnect();
						}
						timeout( pubnub, 1000 );
						SELF['time'](function(success){
												// Reconnect
										if (success && disconnected) {
											disconnected = 0;
											reconnect();
										}
										success || error();
									});
					},
					success : function(messages) {
						if (!CHANNELS[channel].connected) return;

						// Connect
						if (!connected) {
							connected = 1;
							connect();
						}

						// Reconnect
						if (disconnected) {
							disconnected = 0;
							reconnect();
						}

						// Restore Previous Connection Point if Needed
						// Also Update Timetoken
						restore = db.set(
							SUBSCRIBE_KEY + channel,
							timetoken = restore && db.get(
								SUBSCRIBE_KEY + channel
								) || messages[1]
							);

						each( messages[0], function(msg) {
							callback( msg, messages );
						} );

						timeout( pubnub, 10 );
					}
				});
			}

			// Begin Recursive Subscribe
			pubnub();
		}
	};
	return SELF;
};