document.getElementById('fileForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const logOutput = document.getElementById('logOutput');
    const downloadSection = document.getElementById('downloadSection');
    
    // Validate file selection
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file.');
        return;
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('file', file);

    // Update UI to show processing state
    logOutput.textContent = 'Starting processing...';
    downloadSection.classList.add('hidden');

    try {
        // Send file to server
        const response = await fetch('../process-hex', {
            method: 'POST',
            body: formData
        });

        console.log(response);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle the JSON response
        const data = await response.json(); // Parse the response body as JSON

        if (data.error) {
            throw new Error(data.error); // Check if there's an error in the response
        }

        // Update UI with success state
        logOutput.textContent = `Status: ${data.message}`;
        downloadSection.classList.remove('hidden');
        
        const downloadLink = document.getElementById('downloadLink');
        downloadLink.href = data.downloadLink;

    } catch (error) {
        // Handle errors
        logOutput.textContent = `Status: ${error.message}`;
        downloadSection.classList.add('hidden');
        console.error('Error:', error);
    }
});
