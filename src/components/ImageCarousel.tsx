import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
// import { KuitBannerPng2, MakersBanner } from "@/assets";

// const ImageList = [KuitBannerPng2, MakersBanner];
const ImageList = [];

const ImageCarousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay()]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(
    () => emblaApi && emblaApi.scrollPrev(),
    [emblaApi]
  );
  const scrollNext = useCallback(
    () => emblaApi && emblaApi.scrollNext(),
    [emblaApi]
  );
  const scrollTo = useCallback(
    (index: number) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="embla relative h-[86px]">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="embla__container flex">
          {ImageList.map((src, idx) => (
            <Image key={idx} src={src} idx={idx} />
          ))}
        </div>
      </div>
      <button
        className="absolute top-1/2 left-2 -translate-y-1/2 bg-white/50 rounded-full p-1 opacity-0 transition-opacity duration-300 hover:opacity-100 group-hover:opacity-100"
        onClick={scrollPrev}
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        className="absolute top-1/2 right-2 -translate-y-1/2 bg-white/50 rounded-full p-1 opacity-0 transition-opacity duration-300 hover:opacity-100 group-hover:opacity-100"
        onClick={scrollNext}
      >
        <ChevronRight className="w-6 h-6" />
      </button>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
        {scrollSnaps.map((_, index) => (
          <button
            key={index}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              index === selectedIndex ? "bg-white" : "bg-white/50"
            }`}
            onClick={() => scrollTo(index)}
          />
        ))}
      </div>
    </div>
  );
};

const Image = ({ src, idx }: { src: string; idx: number }) => {
  return (
    <div className="embla__slide flex-[0_0_100%] min-w-0">
      <img
        src={src}
        alt={`Banner ${idx}`}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default ImageCarousel;
