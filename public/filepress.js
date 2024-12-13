class FilePressService {
    constructor() {
        this.domain = 'https://new3.filepress.top';
    }

    async convertLink(driveId) {
        try {
            const response = await fetch('/api/filepress/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: driveId
                })
            });

            const result = await response.json();
            
            if (result.status && result.data?._id) {
                return {
                    success: true,
                    link: `${this.domain}/file/${result.data._id}`
                };
            }

            throw new Error(result.message || 'Failed to generate link');

        } catch (error) {
            console.error('FilePress API Error:', error);
            throw error;
        }
    }
}

window.FilePressService = FilePressService; 