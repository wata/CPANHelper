var cpan_url    = 'https://metacpan.org';
var notified    = {};
var modules     = {};
var suggestions = {};
if (!localStorage.getItem('settings')) {
    localStorage.setItem('settings', JSON.stringify({
        notify   : true,
        display  : 10,
        all      : true,
        favorites: ['Plack']
    }));
}

chrome.omnibox.onInputEntered.addListener(function(text){
    searchOnCPAN(text);
});

chrome.omnibox.onInputChanged.addListener(function(text, suggest){
    suggest(suggestions[text] || getSuggestions(text));
});

chrome.contextMenus.create({
    title   : 'Search the CPAN',
    contexts: ['selection'],
    onclick : function(info, tab){ searchOnCPAN(info.selectionText) }
});

/*
 * Get suggestions from metacpan.org
 */
function getSuggestions(text){
    var query = cpan_url + '/search/autocomplete?q=' + text;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", query, false);
    xhr.send();
    var json = JSON.parse(xhr.responseText);
    console.log(json);    // for debug
    suggestions[text] = [];
    $(json).each(function(){
        // Save module
        modules[this.documentation] = {
            package: this.documentation,
            author : this.author,
        };
        // Save suggestion
        suggestions[text].push({
            content    : this.documentation,
            description: this.documentation + ' ' + this.author + '/' + this.release
        });
    });
    return suggestions[text];
}

/*
 * Search on metacpan.org
 */
function searchOnCPAN(text){
    var path       = modules[text] ? '/module/' : '/search?q=';
    var target_url = encodeURI(cpan_url + path + text);
    selectOrCreateTab(target_url);
}

/*
 * Create tab
 */
function selectOrCreateTab(url){
    chrome.tabs.getAllInWindow(null, function(tabs){
        $(tabs).each(function(){
            if (this.url == url) {
                chrome.tabs.update(this.id, { selected: true });
                return;
            }
        });
        chrome.tabs.create({ url: url });
    });
}

/*
 * Check CPAN releases
 */
google.load("feeds", "1");
function loadFeed(){
    var settings = JSON.parse(localStorage.getItem('settings'));
    var feed = new google.feeds.Feed("http://frepan.org/feed/index.rss");
    feed.setNumEntries(20);
    feed.load(function(result){
        if (!result.error) {
            var arry = [];
            $(result.feed.entries).each(function(){
                var entry = this;
                if (settings.notify) {
                    entry.content.match(/img src="([^"]+)"/);
                    var notification = {
                        avatar : RegExp.$1,
                        title  : entry.title,
                        message: entry.contentSnippet,
                        link   : entry.link
                    };
                    // Fetch keywords
                    if (!notified[entry.title] && !settings.all && settings.favorites.length) {
                        $(settings.favorites).each(function(){
                            var keyword = this;
                            var re = new RegExp(keyword, "i");
                            if (entry.title.match(re) != null) {
                                notify(notification, settings.display);
                                notified[entry.title] = true;
                            }
                        });
                    }
                    else if (!notified[entry.title]) {
                        notify(notification, settings.display);
                        notified[entry.title] = true;
                    }
                    arry.push(notification);
                }
            });
            // Save notifications for popup.html
            localStorage.setItem('notifications', JSON.stringify(arry));
        }
    });
    // Run again next interval
    setTimeout(loadFeed, 10000);
}
// Once the Google Feeds API starts check the feeds
google.setOnLoadCallback(loadFeed);

/*
 * Notify desktop
 */
function notify(notification, display){
    // Check permission
    if (webkitNotifications.checkPermission() == 0) {
        var popup = webkitNotifications.createNotification(
            notification['avatar'],
            notification['title'],
            notification['message']
        );
        popup.ondisplay = function(){
            setTimeout(function(){
                popup.cancel();
            }, display * 1000);
        };
        popup.onclick = function(){
            selectOrCreateTab(notification[link]);
            popup.cancel();
        };
        popup.show();
    } else {
        // Request permission
        webkitNotifications.requestPermission();
    }
}
