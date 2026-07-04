const STORAGE_KEY = 'upload_activity_v1';

const getTodayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getEmptyState = () => ({
    date: getTodayKey(),
    items: {}
});

const loadState = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return getEmptyState();
        }

        const parsed = JSON.parse(raw);
        if (!parsed || parsed.date !== getTodayKey() || typeof parsed.items !== 'object' || parsed.items === null) {
            return getEmptyState();
        }

        return parsed;
    } catch {
        return getEmptyState();
    }
};

const saveState = (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const getTodayUploadActivity = () => {
    const state = loadState();
    return Object.values(state.items).sort((left, right) => {
        const leftTime = new Date(left.lastUploadedAt || 0).getTime();
        const rightTime = new Date(right.lastUploadedAt || 0).getTime();
        return rightTime - leftTime;
    });
};

export const getTodayUploadActivityIds = () => {
    return getTodayUploadActivity().map((item) => item.fileId);
};

export const recordUploadActivity = ({ fileId, name, duplicate = false }) => {
    if (!fileId) {
        return;
    }

    const state = loadState();
    const existing = state.items[fileId] || {};

    state.items[fileId] = {
        fileId,
        name: name || existing.name || 'Unknown PDF',
        duplicate: Boolean(duplicate || existing.duplicate),
        lastUploadedAt: new Date().toISOString()
    };

    saveState(state);
};

export const getTodayActivityMetadata = (fileId) => {
    const state = loadState();
    return state.items[fileId] || null;
};

export const mergeDocumentsWithTodayActivity = (documents) => {
    const activityMap = new Map(getTodayUploadActivity().map((item) => [item.fileId, item]));

    return documents.map((document) => {
        const activity = activityMap.get(document.id);
        return {
            ...document,
            isInTodayActivity: Boolean(activity),
            wasDuplicateUploadToday: Boolean(activity?.duplicate),
            activityTimestamp: activity?.lastUploadedAt || null
        };
    });
};

export const sortByTodayActivityThenUploadTime = (documents) => {
    return [...documents].sort((left, right) => {
        const leftActivity = left.activityTimestamp ? new Date(left.activityTimestamp).getTime() : 0;
        const rightActivity = right.activityTimestamp ? new Date(right.activityTimestamp).getTime() : 0;

        if (leftActivity !== rightActivity) {
            return rightActivity - leftActivity;
        }

        const leftUpload = new Date(left.uploaded_at || 0).getTime();
        const rightUpload = new Date(right.uploaded_at || 0).getTime();
        return rightUpload - leftUpload;
    });
};