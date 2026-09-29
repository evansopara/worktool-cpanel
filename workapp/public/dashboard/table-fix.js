(function() {
    'use strict';

    function modifyTables() {
        const tables = document.querySelectorAll('table');
        
        tables.forEach(table => {
            if (table.dataset.modified) return;
            
            const headerRow = table.querySelector('thead tr');
            if (!headerRow) return;

            const headers = Array.from(headerRow.querySelectorAll('th'));
            const headerTexts = headers.map(th => th.textContent.trim().toLowerCase());
            
            const descIndex = headerTexts.findIndex(h => h.includes('description'));
            const assigneeIndex = headerTexts.findIndex(h => h.includes('assignee'));
            const projectIndex = headerTexts.findIndex(h => h.includes('project'));
            const titleIndex = headerTexts.findIndex(h => h === 'title' || h === 'task' || h.includes('title'));

            if (descIndex === -1 && assigneeIndex === -1 && projectIndex === -1 && titleIndex === -1) {
                return;
            }

            const rows = table.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                
                if (descIndex !== -1 && cells[descIndex]) {
                    cells[descIndex].style.display = 'none';
                }
                
                if (assigneeIndex !== -1 && cells[assigneeIndex]) {
                    const text = cells[assigneeIndex].textContent.trim();
                    const words = text.split(/\s+/);
                    if (words.length > 1) {
                        cells[assigneeIndex].innerHTML = words.map(w => `<span style="display:block">${w}</span>`).join('');
                        cells[assigneeIndex].style.whiteSpace = 'normal';
                        cells[assigneeIndex].style.lineHeight = '1.2';
                    }
                }
                
                if (projectIndex !== -1 && titleIndex !== -1 && cells[projectIndex] && cells[titleIndex]) {
                    const projectText = cells[projectIndex].textContent.trim();
                    const titleText = cells[titleIndex].textContent.trim();
                    const assigneeText = (assigneeIndex !== -1 && cells[assigneeIndex]) 
                        ? cells[assigneeIndex].textContent.trim().replace(/\s+/g, ' ') 
                        : '';
                    
                    const combined = `Project: ${projectText}\n${titleText}\nby ${assigneeText}`.trim();
                    cells[projectIndex].innerHTML = combined.replace(/\n/g, '<br>');
                    cells[projectIndex].style.whiteSpace = 'normal';
                    cells[projectIndex].style.lineHeight = '1.4';
                    
                    if (titleIndex > projectIndex) {
                        cells[titleIndex].style.display = 'none';
                    } else {
                        cells[projectIndex].style.display = 'none';
                    }
                }
            });

            if (descIndex !== -1) {
                headers[descIndex].style.display = 'none';
            }
            
            if (titleIndex !== -1 && projectIndex !== -1 && titleIndex !== projectIndex) {
                const hideIndex = titleIndex > projectIndex ? titleIndex : projectIndex;
                if (headers[hideIndex]) {
                    headers[hideIndex].style.display = 'none';
                }
            }

            table.dataset.modified = 'true';
        });
    }

    function init() {
        modifyTables();
        
        const observer = new MutationObserver(() => {
            modifyTables();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();