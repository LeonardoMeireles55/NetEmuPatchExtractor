document.addEventListener('DOMContentLoaded', function() {
    const downloadLink = document.getElementById('downloadLink');
    const originalText = downloadLink.textContent;

    downloadLink.innerHTML = `
        <svg class="download-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>${originalText}</span>
    `;

    downloadLink.addEventListener('click', function(e) {
        // Only trigger animation if it's a real download (has href)
        if (this.getAttribute('href') !== '#') {
            this.classList.add('loading-button');
            this.disabled = true;
            
            const icon = this.querySelector('.download-icon');
            icon.classList.add('spin');
            
            // Remove animation after 4 seconds
            setTimeout(() => {
                this.classList.remove('loading-button');
                this.disabled = false;
                icon.classList.remove('spin');
            }, 4000);
        }
    });
});

// Update the existing form submit handler
document.getElementById('fileForm').addEventListener('submit', async function(event) {
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
        const response = await fetch('../process-hex', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        logOutput.textContent = `Status: ${data.message}`;
        downloadSection.classList.remove('hidden');
        
        const downloadLink = document.getElementById('downloadLink');
        downloadLink.href = data.downloadLink;
    } catch (error) {
        logOutput.textContent = `Status: ${error.message}`;
        downloadSection.classList.add('hidden');
        console.error('Error:', error);
    }
});