#ifndef SUMMARYVIEW_HPP
#define SUMMARYVIEW_HPP

#include <gui_generated/summary_screen/summaryViewBase.hpp>
#include <gui/summary_screen/summaryPresenter.hpp>
#include <touchgfx/widgets/TextAreaWithWildcard.hpp>
#include <touchgfx/Unicode.hpp>
#include <stddef.h>

class summaryView : public summaryViewBase
{
public:
    summaryView();
    virtual ~summaryView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();

    /* Suppress the Designer-generated "go to splash immediately" behaviour. */
    virtual void transitionBegins() {}

    /* Called by presenter once session data is available. */
    void setDisplayData(int defectCount, const char* operatorName);

    virtual void handleTickEvent();

protected:
private:
    static const size_t COUNT_BUF_SIZE = 16;
    static const size_t NAME_BUF_SIZE  = 32;
    static const size_t LABEL_BUF_SIZE = 32;

    touchgfx::Unicode::UnicodeChar m_countBuf[COUNT_BUF_SIZE];
    touchgfx::Unicode::UnicodeChar m_nameBuf[NAME_BUF_SIZE];
    touchgfx::Unicode::UnicodeChar m_labelBuf[LABEL_BUF_SIZE];

    touchgfx::TextAreaWithOneWildcard m_countDisplay;
    touchgfx::TextAreaWithOneWildcard m_labelDisplay;
    touchgfx::TextAreaWithOneWildcard m_nameDisplay;

    int m_tickCount;
};

#endif // SUMMARYVIEW_HPP
