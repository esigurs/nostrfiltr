import React, { useState, useEffect } from 'react';
import NDK, { NDKRelaySet, NDKNip07Signer } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [npubFilter, setNpubFilter] = useState('');
  const [zappedOnly, setZappedOnly] = useState(false);
  const [hasMore, setHasMore] = useState(true); // Track if there are more notes to load
  const [relayError, setRelayError] = useState(null);

  const npubToPubkey = (npub) => {
    try {
      const { type, data } = nip19.decode(npub);
      if (type === 'npub') {
        return data;
      } else {
        return null;
      }
    } catch (e) {
      return null;
    }
  };

  const fetchNotes = async (since) => {
    if (!hasMore && !since) return; // Don't fetch if no more notes and not loading more

    setLoading(true);
    if (!since) {
        setError(null);
        setNotes([]); // Clear notes only on initial fetch
    }
    let sub;

    try {
      const pubkey = npubToPubkey(npubFilter);
      if (!pubkey) {
        setError('Invalid npub.');
        setLoading(false);
        return;
      }

      const ndk = new NDK({ explicitRelayUrls: ['wss://relay.damus.io'] });

      await ndk.connect();

      let filters = [{ kinds: [1], authors: [pubkey] }];
      if (since) {
        filters[0].since = since; // Fetch notes since the last fetched note
      }

      sub = ndk.subscribe(filters, { groupable: false, closeOnEose: false }); // Don't close on EOSE
      const fetchedNotes = [];

      sub.on('event', event => {
        if (zappedOnly) {
          fetchedNotes.push(event);
        } else {
          fetchedNotes.push(event);
        }
      });

      sub.on('eose', () => {
        if (fetchedNotes.length > 0) {
          setNotes(prevNotes => [...prevNotes, ...fetchedNotes]); // Append new notes
          setLoading(false);
          setRelayError(null);
        } else {
          setHasMore(false); // No more notes to load
          if (!since) { // If it's the initial fetch and no notes
            setError('No notes found for this npub on the connected relay.');
          }
          setLoading(false);
          setRelayError(null);
        }
        sub.stop();
      });

      sub.on('error', (err) => {
        setLoading(false);
        setRelayError(`Relay error: ${err}`); // Specific relay error
        sub.stop();
      });

    } catch (err) {
      setError(`Failed to fetch notes: ${err.message || err}`);
      setLoading(false);
      console.error("Error fetching notes:", err);
      if (sub) {
        sub.stop();
      }
    }
  };

  const handleNpubFilterChange = (event) => {
    setNpubFilter(event.target.value);
  };

  const handleZappedOnlyChange = (event) => {
    setZappedOnly(event.target.checked);
  };

  const handleNpubSubmit = (event) => {
    if (event.key === 'Enter') {
      setHasMore(true); // Reset hasMore on new search
      fetchNotes();
    }
  };

  const handleLoadMore = () => {
    if (notes.length > 0) {
      const lastNote = notes[notes.length - 1];
      fetchNotes(lastNote.created_at); // Fetch notes older than the last one
    }
  };

  useEffect(() => {
    if (relayError) {
      setError(relayError); // Show relay error if any
    }
  }, [relayError]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Nostr Notes</h1>

      <div className="mb-4 flex space-x-4 justify-center">
        <div>
          <label htmlFor="npubFilter" className="block text-sm font-medium text-gray-700">Npub Filter:</label>
          <input
            type="text"
            id="npubFilter"
            className="mt-1 p-2 border rounded-md w-full max-w-xs"
            placeholder="Enter npub key and press Enter"
            value={npubFilter}
            onChange={handleNpubFilterChange}
            onKeyDown={handleNpubSubmit}
          />
        </div>

        <div>
          <label htmlFor="zappedOnly" className="block text-sm font-medium text-gray-700">Zapped Notes Only:</label>
          <input
            type="checkbox"
            id="zappedOnly"
            className="mt-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            checked={zappedOnly}
            onChange={handleZappedOnlyChange}
          />
        </div>
      </div>

      {loading && <p className="text-center">Loading notes...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      <div className="mt-6">
        {notes.map(note => (
          <div key={note.id} className="bg-white shadow-md rounded-lg p-6 mb-4">
            <p className="text-gray-800 break-words">{note.content}</p>
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                Author: {note.pubkey.substring(0, 10)}...
              </p>
              <p className="text-sm text-gray-500">
                Created at: {new Date(note.created_at * 1000).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
