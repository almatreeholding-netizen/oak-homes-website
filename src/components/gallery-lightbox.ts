// src/components/gallery-lightbox.ts
//
// The property-photo lightbox island. This and the mobile nav drawer's
// pure-CSS checkbox toggle are the only client-side behaviour in the site
// (SKELETON.md). Wiring is deferred behind an IntersectionObserver so each
// gallery's listeners attach only once it scrolls into view -- the same
// "lazy until visible" behaviour Astro's client:visible directive describes
// for framework islands, reproduced by hand since no UI-framework
// integration is installed here (Gallery.astro's data-hydrate marker
// documents the same intent in built HTML).
//
// Keyboard contract: Escape closes, ArrowLeft/ArrowRight step between
// photos, focus moves into the lightbox on open and returns to the
// triggering thumbnail on close, and Tab is trapped among the lightbox's
// own three controls while open.

interface GalleryPhoto {
  src: string;
  alt: string;
}

function initGallery(root: HTMLElement): void {
  const triggers = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-gallery-trigger]'));
  if (triggers.length === 0) return;

  const lightbox = root.querySelector<HTMLDivElement>('[data-lightbox]');
  const lightboxImage = root.querySelector<HTMLImageElement>('[data-lightbox-image]');
  const closeBtn = root.querySelector<HTMLButtonElement>('[data-lightbox-close]');
  const prevBtn = root.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-lightbox-next]');
  if (!lightbox || !lightboxImage || !closeBtn || !prevBtn || !nextBtn) return;

  const photos: GalleryPhoto[] = triggers.map((trigger) => {
    const img = trigger.querySelector('img');
    return {
      src: img?.getAttribute('src') ?? '',
      alt: img?.getAttribute('alt') ?? 'Property photo',
    };
  });

  const focusable = [closeBtn, prevBtn, nextBtn];
  let currentIndex = 0;
  let triggerOnOpen: HTMLElement | null = null;

  function render(index: number): void {
    const photo = photos[index];
    if (!photo) return;
    lightboxImage!.src = photo.src;
    lightboxImage!.alt = photo.alt;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
      return;
    }
    if (event.key === 'Tab') {
      const activeIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      const nextIndex = event.shiftKey
        ? (activeIndex - 1 + focusable.length) % focusable.length
        : (activeIndex + 1) % focusable.length;
      focusable[nextIndex]?.focus();
    }
  }

  function open(index: number, opener: HTMLElement): void {
    currentIndex = index;
    triggerOnOpen = opener;
    render(currentIndex);
    lightbox!.hidden = false;
    lightbox!.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn!.focus();
    document.addEventListener('keydown', onKeydown);
  }

  function close(): void {
    lightbox!.hidden = true;
    lightbox!.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown);
    triggerOnOpen?.focus();
    triggerOnOpen = null;
  }

  function step(delta: number): void {
    currentIndex = (currentIndex + delta + photos.length) % photos.length;
    render(currentIndex);
  }

  triggers.forEach((trigger, index) => {
    trigger.addEventListener('click', () => open(index, trigger));
  });
  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  // Touch swipe support -- left swipe advances, right swipe goes back.
  let touchStartX = 0;
  const SWIPE_THRESHOLD_PX = 40;
  lightbox.addEventListener(
    'touchstart',
    (event: TouchEvent) => {
      touchStartX = event.changedTouches[0]?.clientX ?? 0;
    },
    { passive: true },
  );
  lightbox.addEventListener(
    'touchend',
    (event: TouchEvent) => {
      const touchEndX = event.changedTouches[0]?.clientX ?? 0;
      const delta = touchEndX - touchStartX;
      if (delta > SWIPE_THRESHOLD_PX) step(-1);
      else if (delta < -SWIPE_THRESHOLD_PX) step(1);
    },
    { passive: true },
  );
}

function bootstrap(): void {
  const galleries = Array.from(document.querySelectorAll<HTMLElement>('[data-gallery]'));
  if (galleries.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    galleries.forEach(initGallery);
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        initGallery(entry.target as HTMLElement);
        obs.unobserve(entry.target);
      }
    },
    { rootMargin: '200px' },
  );

  galleries.forEach((gallery) => observer.observe(gallery));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
