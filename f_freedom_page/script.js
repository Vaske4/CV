function toggleFeature(element) {
    const allFeatures = document.querySelectorAll('.feature-item');
    const clickedDescription = element.querySelector('.feature-description');
    const featureImage = document.getElementById('featureImage');
    
    // Close all other descriptions
    allFeatures.forEach(item => {
        if (item !== element) {
            const desc = item.querySelector('.feature-description');
            desc.style.display = 'none';
            item.classList.remove('active');
        }
    });

    // Toggle clicked description
    if (clickedDescription.style.display === 'none' || !clickedDescription.style.display) {
        clickedDescription.style.display = 'block';
        element.classList.add('active');
        
        // Change image with fade effect
        featureImage.style.opacity = '0';
        setTimeout(() => {
            featureImage.src = element.getAttribute('data-image');
            featureImage.style.opacity = '1';
        }, 200);
    } else {
        clickedDescription.style.display = 'none';
        element.classList.remove('active');
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Hide all descriptions initially
    const descriptions = document.querySelectorAll('.feature-description');
    descriptions.forEach(desc => {
        desc.style.display = 'none';
    });
    
    // Get the first feature item and simulate a click
    const firstFeature = document.querySelector('.feature-item');
    if (firstFeature) {
        toggleFeature(firstFeature);
    }
});
