import { use, useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  BannerItemType,
  getBannerImageURL,
  getBannersAPI,
} from "@/apis";
import { recordBreadcrumb } from "@/monitoring";
import { sendBannerOpen } from "@/utils/analytics";
import { isBannerActive } from "@/utils/banner";
import { captureErrorLog, warnLog } from "@/utils/logger";
import { isExpectedNetworkFailure } from "@/utils/networkFailure";

const preloadBannerImage = (imageURL: string) => {
  const image = new window.Image();
  image.src = imageURL;
  return image.decode().then(
    () => true,
    () => false,
  );
};

const isExpectedBannerLoadFailure = (error: unknown) =>
  isExpectedNetworkFailure(error) ||
  (error instanceof Error && /^Failed to fetch banners: \d+$/u.test(error.message));

const bannerPromise = getBannersAPI()
  .then(async ({ banners }) => {
    const currentTime = Date.now();
    const activeBanners = banners.filter((item) =>
      isBannerActive(item, currentTime),
    );
    const imageResults = await Promise.all(
      activeBanners.map(({ img }) =>
        preloadBannerImage(getBannerImageURL(img)),
      ),
    );

    return activeBanners.filter((_, index) => imageResults[index]);
  })
  .catch((error: unknown): BannerItemType[] => {
    const expected = isExpectedBannerLoadFailure(error);
    recordBreadcrumb(
      "banner.request",
      "banner list unavailable",
      { expected_external_failure: expected },
      expected ? "warning" : "error",
    );

    if (expected) {
      warnLog("[Banner] Banner list unavailable", error);
    } else {
      captureErrorLog("[Banner] Failed to load banner list", error);
    }

    // A banner is optional UI. A rejected request must not escape Suspense and
    // replace the whole popup with the global error boundary.
    return [];
  });

const ImageCarousel = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay()]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const imageList = use(bannerPromise);
  const hasMultipleImages = imageList.length > 1;

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

  if (imageList.length === 0) return null;

  return (
    <div className="embla relative h-[85px]">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="embla__container flex">
          {imageList.map((item, index) => (
            <Image key={item.img} item={item} position={index} />
          ))}
        </div>
      </div>

      {hasMultipleImages ? (
        <>
          <button
            className="absolute top-1/2 left-2 -translate-y-1/2 bg-white/50 rounded-full p-1 opacity-0 transition-opacity duration-300 hover:opacity-100 group-hover:opacity-100 cursor-pointer"
            onClick={scrollPrev}
            name="이전 이미지"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            className="absolute top-1/2 right-2 -translate-y-1/2 bg-white/50 rounded-full p-1 opacity-0 transition-opacity duration-300 hover:opacity-100 group-hover:opacity-100 cursor-pointer"
            onClick={scrollNext}
            name="다음 이미지"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-2">
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
        </>
      ) : null}
    </div>
  );
};

const Image = ({ item, position }: { item: BannerItemType; position: number }) => {
  return (
    <div className="embla__slide flex-[0_0_100%] min-w-0">
      <img
        src={getBannerImageURL(item.img)}
        alt={item.alt}
        onClick={() => {
          sendBannerOpen(item.img, item.alt, position);
          window.open(item.link);
        }}
        className="w-full h-full object-cover cursor-pointer"
      />
    </div>
  );
};

export default ImageCarousel;
