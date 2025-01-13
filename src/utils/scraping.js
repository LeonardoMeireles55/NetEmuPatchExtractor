(function () {
    // Select only the PS2 Netemu Commands table section
    const tables = document.querySelectorAll('table.wikitable');
    let fileContent = '';

    tables.forEach(table => {
        // Extract Command ID
        const commandId = table.querySelector('td[title="Command ID"]');

        // Skip tables with "Equivalent Netemu ID" or "Command not available"
        const skipTable = table.textContent.includes('Equivalent Netemu ID') ||
            table.nextElementSibling?.textContent.includes('Command not available in ps2_netemu.self');
        if (skipTable) {
            return;
        }

        // Get row content
        const rows = table.querySelectorAll('tr');
        if (rows.length < 2) return;

        // Get command name and data
        const commandName = rows[0].querySelector('td:last-child');
        const commandData = rows[1].querySelector('td:last-child');

        if (commandId && commandName && commandData) {

            fileContent += `Command ID: ${commandId.textContent.trim()}\n`;
            fileContent += `Command Name: ${commandName.textContent.trim()}\n`;
            fileContent += `Command Data: ${commandData.textContent.trim()}\n`;

            // Get description text after table
            const nextElement = table.nextElementSibling;
            if (nextElement) {
                // Get all text content until next table or heading
                let description = '';
                let currentElement = nextElement;

                while (currentElement &&
                    !currentElement.matches('table, h1, h2, h3, h4, h5, h6')) {
                    if (currentElement.textContent.trim()) {
                        description += currentElement.textContent.trim() + '\n';
                    }
                    currentElement = currentElement.nextElementSibling;
                }

                if (description) {
                    fileContent += `Description: ${description}\n`;
                }
            }

            // Get valid values list if present
            const validValuesList = nextElement && nextElement.tagName === 'UL' ? nextElement :
                nextElement && nextElement.nextElementSibling &&
                    nextElement.nextElementSibling.tagName === 'UL' ?
                    nextElement.nextElementSibling : null;

            if (validValuesList) {
                const validValues = Array.from(validValuesList.querySelectorAll('li'))
                    .map(li => li.textContent.trim())
                    .join(', ');
                if (validValues) {
                    fileContent += `Valid Values: ${validValues}\n`;
                }
            }

            fileContent += '\n-------------------\n\n';
        }
    });

    if (!fileContent) {
        return console.error('No commands found');
    }

    // Create and download file
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([fileContent], { type: 'text/plain' }));
    link.download = 'ps2_netemu_commands.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('PS2 Netemu commands extracted successfully');
})();