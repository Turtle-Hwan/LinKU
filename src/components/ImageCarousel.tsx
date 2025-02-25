import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BannerItemType, getBannersAPI } from "@/apis/getBannersAPI";
import { IMAGE_URL } from "@/constants/URL";

const ImageCarousel = () => {
  const [imageList, setImageList] = useState<BannerItemType[]>([]);
  useEffect(() => {
    getBannersAPI().then((data) => {
      setImageList(data.banners);
    });
  }, []);

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
          {imageList.map((item, idx) => (
            <Image key={idx} item={item} />
          ))}
        </div>
      </div>
      <button
        className="absolute top-1/2 left-2 -translate-y-1/2 bg-white/50 rounded-full p-1 opacity-0 transition-opacity duration-300 hover:opacity-100 group-hover:opacity-100 cursor-pointer"
        onClick={scrollPrev}
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        className="absolute top-1/2 right-2 -translate-y-1/2 bg-white/50 rounded-full p-1 opacity-0 transition-opacity duration-300 hover:opacity-100 group-hover:opacity-100 cursor-pointer"
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
            } cursor-pointer`}
            onClick={() => scrollTo(index)}
          />
        ))}
      </div>
    </div>
  );
};

const Image = ({ item }: { item: BannerItemType }) => {
  return (
    <div className="embla__slide flex-[0_0_100%] min-w-0">
      <img
        src={`${IMAGE_URL}/banners/${item.img}`}
        alt={item.alt}
        onClick={() => window.open(item.link)}
        className="w-full h-full object-cover cursor-pointer"
      />
    </div>
  );
};

export default ImageCarousel;
