import { useEffect, useState } from 'react';

// The URL hash (#/requests) is the only record of which page is showing, so the
// address bar, Back/Forward, refresh and logout can never disagree with the screen.

const CHANGE = 'routechange';

function readRoute() {
    return window.location.hash.replace(/^#\/?/, '');
}

export function goTo(page, { replace = false } = {}) {
    if (page === readRoute()) return;
    const url = window.location.pathname + window.location.search + (page ? `#/${page}` : '');
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    // pushState and replaceState do not fire any event themselves
    window.dispatchEvent(new Event(CHANGE));
}

export function useRoute() {
    const [route, setRoute] = useState(readRoute);
    useEffect(() => {
        const update = () => setRoute(readRoute());
        window.addEventListener('popstate', update);
        window.addEventListener('hashchange', update);
        window.addEventListener(CHANGE, update);
        return () => {
            window.removeEventListener('popstate', update);
            window.removeEventListener('hashchange', update);
            window.removeEventListener(CHANGE, update);
        };
    }, []);
    return route;
}
