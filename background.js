var cpan_url = 'https://metacpan.org';

// Config of search box
chrome.omnibox.onInputEntered.addListener(
    function(text){
        searchOnCPAN(text);
    }
);

// Suggest of inputting
chrome.omnibox.onInputChanged.addListener(
    function(text, suggest){
        var obj = getSuggestions(text);
        var suggestions = [];
        for ( var i = 0, len = obj.length; i < len; i++ ) {
            var tmp = {
                content: obj[i].documentation,
                description: obj[i].documentation + ' ' + obj[i].author + '/' + obj[i].release
            };
            suggestions.push(tmp);
        }
        suggest(suggestions);
    }
);

// Config of context menu
chrome.contextMenus.create({
    title: 'Search the CPAN',
    contexts: ['selection'],
    onclick: function(info, tab){
        var text = info.selectionText;
        searchOnCPAN(text);
    }
});

/*
 * Get suggestions from metacpan.org
 */
function getSuggestions(text){
    var query = cpan_url + '/search/autocomplete?q=' + text;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", query, false);
    xhr.send();
    return JSON.parse(xhr.responseText);
}

/*
 * Search on metacpan.org
 */
function searchOnCPAN(text){
    var obj = getSuggestions(text);
    var path;
    if (obj.length && obj[0].documentation == text) {
        path = '/module/';
    }
    else {
        path = '/search?q=';
    }
    var target_url = encodeURI(cpan_url + path + text);
    selectOrCreateTab(target_url);
}

/*
 * Create tab
 */
function selectOrCreateTab(url){
    chrome.tabs.getAllInWindow(null, function(tabs){
        for ( var i = 0, len = tabs.length; i < len; i++ ) {
            if ( tabs[i].url == url ) {
                chrome.tabs.update(tabs[i].id, { selected: true });
                return;
            }
        }
        chrome.tabs.create({ url: url });
    });
}

// Default settings
if ( !localStorage.getItem('settings') ) {
    var settings = {
        notify: true,
        display: 10,
        all: true,
        favorites: ['Plack']
    };
    localStorage.setItem('settings', JSON.stringify(settings));
}

/*
 * Check CPAN release
 */
var notified = {};
google.load("feeds", "1");
function loadFeed() {
    var settings = JSON.parse(localStorage.getItem('settings'));
    var feed = new google.feeds.Feed("http://frepan.org/feed/index.rss");
    feed.setNumEntries(20);
    feed.load(function(result) {
        if (!result.error) {
            for (var i = 0; i < result.feed.entries.length; i++) {
                var entry = result.feed.entries[i];
                entry.content.match(/img src="([^"]+)"/);
                var img_url = RegExp.$1;
                if (settings.notify) {
                    // Fetch keywords
                    if (settings.favorites.length) {
                        for (var j= 0; j < settings.favorites.length; j++) {
                            var re = new RegExp(settings.favorites[j], "i");
                            if ( entry.title.match(re) != null ) {
                                if (!notified[entry.title]) {
                                    notify(img_url, entry.title, entry.contentSnippet, entry.link, settings.display);
                                    notified[entry.title] = true;
                                }
                            }
                        }
                    }
                    else {
                        if (!notified[entry.title]) {
                            notify(img_url, entry.title, entry.contentSnippet, entry.link, settings.display);
                            notified[entry.title] = true;
                        }
                    }
                }
            }
        }
    });
    //Run again next interval
    setTimeout(loadFeed, 10000);
}
// Once the Google Feeds API starts check the feeds
google.setOnLoadCallback(loadFeed);

/*
 * Notify desktop
 */
function notify(avatar, title, message, link, display){
    // Check permission
    if ( webkitNotifications.checkPermission() == 0 ) {
        var popup = webkitNotifications.createNotification(avatar, title, message);
        popup.ondisplay = function(){
            setTimeout(function(){
                popup.cancel();
            }, display * 1000);
        };
        popup.onclick = function(){
            selectOrCreateTab(link);
            popup.cancel();
        };
        popup.show();
    } else {
        // Request permission
        webkitNotifications.requestPermission();
    }
}
