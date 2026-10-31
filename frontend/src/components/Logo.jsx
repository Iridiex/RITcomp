function Logo({ size = 38, className = '' }) {
    return (
        <img
            className={`logo ${className}`}
            src="/logo-icon.png"
            width={size}
            height={size}
            alt="Relief Dispatch"
        />
    );
}

export default Logo;
