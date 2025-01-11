// Add CSS for loading animation
const style = document.createElement('style');
style.textContent = `
  .loading {
    position: relative;
    opacity: 0.8;
    cursor: wait;
  }
  .loading::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', function () {
    const extractButton = document.getElementById('btn');
    const downloadLink = document.getElementById('downloadLink');
    const originalText = downloadLink ? downloadLink.textContent : '';

    if (downloadLink) {
        downloadLink.innerHTML = `
            <svg class="download-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>${originalText}</span>
        `;

        downloadLink.addEventListener('click', function (e) {
            if (this.getAttribute('href') !== '#') {
                this.classList.add('loading-button');
                this.disabled = true;

                const icon = this.querySelector('.download-icon');
                if (icon) {
                    icon.classList.add('spin');
                }

                setTimeout(() => {
                    this.classList.remove('loading-button');
                    this.disabled = false;
                    if (icon) {
                        icon.classList.remove('spin');
                    }
                }, 2000);
            }
        });
    }

    document.getElementById('fileForm').addEventListener('submit', async function (event) {
        event.preventDefault();

        const fileInput = document.getElementById('fileInput');
        const logOutput = document.getElementById('logOutput');
        const downloadSection = document.getElementById('downloadSection');

        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a file.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        logOutput.textContent = 'Starting processing...';
        downloadSection.classList.add('hidden');

        try {
            if (extractButton) {
                extractButton.disabled = true;
                extractButton.classList.add('loading');
                extractButton.textContent = 'Processing...';
            }


            const response = await fetch('../process-hex', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error: Status ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            const jsonConfigResponse = await fetch('../process-hex-json', {
                method: 'POST',
                body: formData
            });

            if (!jsonConfigResponse.ok) {
                throw new Error(`Error: Status ${jsonConfigResponse.status} - ${jsonConfigResponse.statusText}`);
            }

            const jsonConfigs = await jsonConfigResponse.json();

            setTimeout(() => {
                logOutput.textContent = `Success: ${data.message}\nConfigs: ${JSON.stringify(jsonConfigs, null, 2)}`;

            }, 1000);


            if (downloadLink) {
                downloadLink.href = data.downloadLink;
            }

            setTimeout(() => {
                downloadSection.classList.remove('hidden');
                if (extractButton) {
                    extractButton.classList.remove('loading');
                    extractButton.textContent = 'Extract';
                    extractButton.disabled = false;
                }
            }, 1000);

        } catch (error) {
            console.error('Error:', error);
            logOutput.textContent = `Error: ${error.message}`;
            downloadSection.classList.add('hidden');
            if (extractButton) {
                extractButton.classList.remove('loading');
                extractButton.textContent = 'Extract';
                extractButton.disabled = false;
            }
        }
    });
});