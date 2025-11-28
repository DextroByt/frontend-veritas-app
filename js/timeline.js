// --- State for Timeline ---
let currentTimelineItemIds = new Set();

// --- DOM Elements (Specific to timeline.html) ---
const timelineContainer = document.getElementById('timeline-container');
const skeletonContainer = document.getElementById('skeleton-container');
const claimModal = document.getElementById('claim-modal');
const submitClaimBtn = document.getElementById('submit-claim-btn');
const cancelClaimBtn = document.getElementById('cancel-claim-btn');
const claimForm = document.getElementById('claim-form');
const claimTextInput = document.getElementById('claim-text-input');
const verifyNowBtn = document.getElementById('verify-now-btn');
const charCountDisplay = document.getElementById('char-count');
const submissionReceipt = document.getElementById('submission-receipt');

// This script relies on global constants (API_BASE_URL, CRISIS_ID, POLL_INTERVAL_MS, MIN_CLAIM_LENGTH) 
// and utility functions (showToast, createTimelineCard, STATUS_COLORS) defined in main.js.

/**
 * Fetches and renders the timeline with Adaptive Polling and Diffing Logic (Action 3).
 */
async function loadTimeline() {
    if (!timelineContainer || !skeletonContainer) return;
    
    try {
        // Show skeleton loaders if this is the initial load
        if (currentTimelineItemIds.size === 0) {
            skeletonContainer.classList.remove('hidden');
            if (timelineContainer.children.length > 0) timelineContainer.innerHTML = '';
        }

        const response = await fetch(`${API_BASE_URL}/crises/${CRISIS_ID}/timeline`);
        if (!response.ok) throw new Error("Network response was not ok.");
        
        const newItems = await response.json();
        const newItemIds = new Set(newItems.map(item => item.id));
        const newlyAddedItems = [];
        
        // Diffing Logic: Check for new items to prepend and notify
        newItems.forEach(item => {
            if (!currentTimelineItemIds.has(item.id)) {
                newlyAddedItems.push(item);
            }
            currentTimelineItemIds.add(item.id);
        });

        currentTimelineItemIds = newItemIds;
        skeletonContainer.classList.add('hidden');
        
        // --- Re-render/Update Logic ---
        const fragment = document.createDocumentFragment();
        
        newItems.forEach(item => {
            let element = document.getElementById(`timeline-item-${item.id}`);
            
            // If element exists, detach it and re-add for correct sorting.
            if (element) {
                fragment.appendChild(element);
            } else {
                // If element is new, create it.
                element = createTimelineCard(item);
                fragment.appendChild(element);
            }
        });

        timelineContainer.innerHTML = '';
        fragment.childNodes.forEach(child => {
            timelineContainer.appendChild(child);
        });
        
        // Send Toast Notifications for highly impactful new items (Action 6)
        newlyAddedItems.forEach(item => {
            const status = STATUS_COLORS[item.status] || STATUS_COLORS['UNCONFIRMED'];
            const toastMessage = `NEW ${status.label}: ${item.summary.substring(0, 50)}...`;
            showToast(toastMessage, item.status);
        });
        
    } catch (error) {
        console.error("Failed to load timeline:", error);
        if (currentTimelineItemIds.size === 0) {
            skeletonContainer.innerHTML = `<p class="text-red-600 text-center p-8">Error loading data. Check API connection.</p>`;
        }
    }
}

/**
 * Initializes all dashboard functionality, including polling and event listeners.
 */
function initializeTimeline() {
    if (!submitClaimBtn) return;
    
    // Initial Load and Adaptive Polling (Action 3)
    loadTimeline();
    setInterval(loadTimeline, POLL_INTERVAL_MS);

    // Modal Open/Close Logic
    submitClaimBtn.addEventListener('click', () => {
        claimModal.classList.remove('hidden');
        claimModal.classList.add('flex');
        claimTextInput.focus();
        submissionReceipt.classList.add('hidden'); // Reset receipt
        claimTextInput.value = ''; // Clear input
        verifyNowBtn.disabled = true; // Reset button state
        charCountDisplay.classList.remove('text-green-500');
        charCountDisplay.classList.add('text-red-500');
        charCountDisplay.textContent = `0 / ${MIN_CLAIM_LENGTH} required`;
    });

    cancelClaimBtn.addEventListener('click', () => {
        claimModal.classList.add('hidden');
        claimModal.classList.remove('flex');
    });

    // Client-Side Validation (Action 4)
    claimTextInput.addEventListener('input', () => {
        const length = claimTextInput.value.length;
        const isValid = length >= MIN_CLAIM_LENGTH;
        verifyNowBtn.disabled = !isValid;
        charCountDisplay.textContent = `${length} / ${MIN_CLAIM_LENGTH} required`;
        
        // Positive reinforcement UX
        if (isValid) {
            charCountDisplay.classList.remove('text-red-500');
            charCountDisplay.classList.add('text-green-500');
        } else {
            charCountDisplay.classList.remove('text-green-500');
            charCountDisplay.classList.add('text-red-500');
        }
    });

    // Claim Submission Handler (Action 4)
    claimForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const claimText = claimTextInput.value.trim();
        if (claimText.length < MIN_CLAIM_LENGTH) return;

        verifyNowBtn.disabled = true;
        verifyNowBtn.textContent = 'Submitting...';

        try {
            const response = await fetch(`${API_BASE_URL}/crises/${CRISIS_ID}/submit-claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claim_text: claimText })
            });
            
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`Submission failed. Status: ${response.status}. Status Text: ${response.statusText}. Response Body:`, errorBody);
                throw new Error(`Submission failed. Status: ${response.status}`);
            }

            const receipt = await response.json();
            
            claimTextInput.style.display = 'none';
            const buttonContainer = claimForm.querySelector('.flex');
            if (buttonContainer) buttonContainer.style.display = 'none';
            
            document.getElementById('receipt-id').textContent = receipt.id.substring(0, 8) + '...';
            submissionReceipt.classList.remove('hidden');
            
            showToast(`Claim submitted! ID ${receipt.id.substring(0, 8)}. Status: PENDING.`, 'UNCONFIRMED');

            setTimeout(() => {
                claimModal.classList.add('hidden');
                claimModal.classList.remove('flex');
                claimTextInput.style.display = 'block';
                if (buttonContainer) buttonContainer.style.display = 'flex'; 
                verifyNowBtn.textContent = 'VERIFY NOW';
                
                claimTextInput.dispatchEvent(new Event('input')); 
            }, 5000);

        } catch (error) {
            console.error("Claim submission failed (Catch Block):", error);
            verifyNowBtn.textContent = 'Failed. Retry?';
            verifyNowBtn.disabled = false;
            showToast(`Failed to submit claim: ${error.message}`, 'DEBUNKED');
        }
    });
}

document.addEventListener('DOMContentLoaded', initializeTimeline);