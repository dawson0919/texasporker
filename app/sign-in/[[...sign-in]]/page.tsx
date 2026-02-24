import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#221e10]/90 font-['Inter']">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 z-0 h-full w-full bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAq3JiOmxLLC33hCt0RaqMqag0yjC274Akv9S-ciosLtMELYTTAW4EkuDxpHrfca3412y14lNtcNMLmzz1KyP3ghnlOpcP9XxazDRlxiXGB2Xk7JG1IrwY_6WNiZWcIzKGJF7giRRUz4JE0Ef5TSQO6U_ud7VJ30z5TRpAF0l-pzSmwVwojnTXSQdzI9AwfinRJl6w13V8ZBQUGgy1M87s9SkizAMDxXpN4gM1cS-rqQAmE-6Jv5jz4HwhqqCekj-IzuzRRAh_0z7rk')" }}
            >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#221e10] via-transparent to-transparent"></div>
            </div>

            <div className="relative z-10 flex h-full grow flex-col justify-center items-center px-4 py-8">
                {/* We use Clerk's SignIn component but wrap it in our layout. 
            Clerk handles its own card, so we'll configure its appearance prop 
            to match the requested "Macau Casino Royale" theme. */}

                <div className="flex flex-col items-center mb-8">
                    <div className="h-16 w-16 mb-4 flex items-center justify-center rounded-full bg-[#f4c025]/10 border border-[#f4c025]/20 text-[#f4c025]">
                        <span className="material-symbols-outlined !text-4xl">casino</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white text-center">Macau Casino Royale</h1>
                    <p className="mt-2 text-sm text-slate-300 text-center">Sign in to access your premium account</p>
                </div>

                <SignIn
                    appearance={{
                        elements: {
                            card: "bg-[#f8f8f5] shadow-[0_0_50px_rgba(244,192,37,0.15)] ring-1 ring-[#f4c025]/20 rounded-xl overflow-hidden backdrop-blur-md",
                            headerTitle: "hidden", // We provide our own header above
                            headerSubtitle: "hidden", // We provide our own subtitle above
                            socialButtonsBlockButton: "rounded-full h-12 px-6 border border-slate-200 hover:bg-slate-50 transition-colors text-slate-900 text-base font-medium",
                            dividerText: "text-slate-500",
                            formFieldInput: "rounded-lg border-0 bg-white py-3.5 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-[#f4c025] sm:text-sm sm:leading-6",
                            formButtonPrimary: "rounded-full h-12 px-6 bg-[#f4c025] hover:bg-[#f4c025]/90 text-[#221e10] text-base font-bold tracking-wide transition-all shadow-[0_4px_14px_rgba(244,192,37,0.4)]",
                            footerActionLink: "text-[#f4c025] hover:text-[#f4c025]/80 font-medium",
                            footer: "bg-slate-50 border-t border-slate-100",
                            logoImage: "hidden"
                        }
                    }}
                />

                {/* Bottom Links */}
                <div className="mt-8 flex gap-6 text-sm text-white/60">
                    <a href="#" className="hover:text-white transition-colors">Help</a>
                    <a href="#" className="hover:text-white transition-colors">Privacy</a>
                    <a href="#" className="hover:text-white transition-colors">Terms</a>
                </div>
            </div>
        </div>
    );
}
