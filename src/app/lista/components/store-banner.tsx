"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";

export function StoreBanner({ config }: { config: any }) {
    const isSliderMode = config.isBannerSlider && Array.isArray(config.banners) && config.banners.length > 0;

    const [currentSlide, setCurrentSlide] = React.useState(0);

    React.useEffect(() => {
        if (!isSliderMode) return;

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % config.banners.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isSliderMode, config.banners?.length]);

    if (!isSliderMode && !config.bannerData) return null;

    const { theme, radiusClass } = getThemeStyles(config.themeIdentifier);

    return (
        <section className="animate-in fade-in slide-in-from-top-4 duration-1000">
            <div
                className={cn(
                    "relative aspect-[3/2] sm:aspect-[21/9] w-full overflow-hidden shadow-2xl",
                    radiusClass,
                    theme !== 'minimal' && theme !== 'luxury' ? "border-2 sm:border-4 border-primary/10" : ""
                )}
                style={{ backgroundColor: config.secondaryColor }}
            >
                {/* Images Container */}
                <div className="absolute inset-0 w-full h-full">
                    {isSliderMode ? (
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.img
                                key={currentSlide}
                                initial={{ opacity: 0, scale: 1.05 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1, ease: "easeInOut" }}
                                src={`data:${config.banners[currentSlide].bannerMime};base64,${config.banners[currentSlide].bannerData}`}
                                className="absolute inset-0 w-full h-full object-cover"
                                alt={`Banner Slide ${currentSlide + 1}`}
                            />
                        </AnimatePresence>
                    ) : (
                        <img
                            src={`data:${config.bannerMime};base64,${config.bannerData}`}
                            className="w-full h-full object-cover opacity-90"
                            alt="Banner de la tienda"
                        />
                    )}
                </div>

                {/* Overlay Area with Animated Text */}
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-4 sm:p-8 md:p-16 text-center text-white backdrop-blur-[2px]">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="font-black text-2xl sm:text-3xl md:text-5xl lg:text-6xl tracking-tighter drop-shadow-2xl mb-3"
                    >
                        BIENVENIDOS
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-[10px] sm:text-sm font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] bg-white/10 backdrop-blur-md px-4 sm:px-6 py-2 rounded-full border border-white/20"
                    >
                        Explorá nuestra selección exclusiva
                    </motion.p>
                </div>

                {/* Slider Indicators */}
                {isSliderMode && config.banners.length > 1 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                        {config.banners.map((_: any, idx: number) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentSlide(idx)}
                                className={cn(
                                    "w-2 h-2 rounded-full transition-all duration-300",
                                    currentSlide === idx ? "bg-white w-6" : "bg-white/50 hover:bg-white/80"
                                )}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}